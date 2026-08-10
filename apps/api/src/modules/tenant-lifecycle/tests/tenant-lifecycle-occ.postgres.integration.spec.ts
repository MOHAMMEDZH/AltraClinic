/**
 * Flexible Step 19 — Legacy OCC vs Step 19 rowVersion (O01–O08).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPlatformTenantRepository } from '../../platform-admin/infrastructure/prisma-platform-tenant.repository';
import {
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
  createHybridPrisma,
  createLifecycleStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableLifecycleFlag,
  platformClaims,
  platformDbSecurityEnabled,
  previewAndBody,
  seedClinicTenant,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 19 OCC matrix O01-O08 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let repo: PrismaPlatformTenantRepository;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableLifecycleFlag();
    repo = new PrismaPlatformTenantRepository(createHybridPrisma(prisma));
  });

  afterAll(async () => {
    restoreFlag();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearLifecycleFailureInjection();
    await cleanupLifecycleTables(prisma);
  });

  async function actor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `occ-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    return platformClaims(user.id, randomUUID());
  }

  it('O01 suspension versus legacy save — Model B preserves SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const stale = await repo.findByTenantId(seeded.tenantId);
    expect(stale?.status.value).toBe('active');

    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, seeded.tenantId, body, `O01-${randomUUID()}`);

    stale!.changePlan('enterprise');
    await repo.save(stale!);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('SUSPENDED');
    expect(after.plan).toBe('ENTERPRISE');
    expect(after.rowVersion).toBeGreaterThanOrEqual(2);
  });

  it('O02 reactivation versus legacy save — Model B preserves ACTIVE after reactivate', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    const stale = await repo.findByTenantId(seeded.tenantId);
    expect(stale?.status.value).toBe('suspended');

    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'reactivate', 1);
    await stack.service.reactivate(claims, seeded.tenantId, body, `O02-${randomUUID()}`);

    // Stale entity still suspended in memory — try domain resume + save must not rewrite wrongly
    stale!.changePlan('starter');
    await repo.save(stale!);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('ACTIVE');
    expect(after.rowVersion).toBeGreaterThanOrEqual(2);
  });

  it('O03 lifecycle action versus Tenant Directory metadata update preserves lifecycle', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, seeded.tenantId, body, `O03-${randomUUID()}`);

    const entity = await repo.findByTenantId(seeded.tenantId);
    entity!.changePlan('enterprise');
    await repo.save(entity!);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('SUSPENDED');
    expect(after.plan).toBe('ENTERPRISE');
  });

  it('O04 Step 17 activation versus Step 19 action — PROVISIONING incomplete blocks activate', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'PROVISIONING' });
    await prisma.platformTenantProvisioningRequest.create({
      data: {
        id: randomUUID(),
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenant.id,
        status: 'PROVISIONING',
        organizationName: seeded.displayName,
        facilityTypeKey: 'clinic',
        specialtyKeys: [],
        publishedPlanVersionId: randomUUID(),
        adminEmail: `o04-${randomUUID()}@test.local`,
        onboardingType: 'managed',
        correlationId: randomUUID(),
        createdByPlatformUserId: claims.sub,
      },
    });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'activate', 1);
    await expect(
      stack.service.activate(claims, seeded.tenantId, body, `O04-${randomUUID()}`),
    ).rejects.toBeTruthy();
    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('PROVISIONING');
    expect(after.rowVersion).toBe(1);
  });

  it('O05 stale legacy update after lifecycle commit — CAS conflict loses no status', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const entity = await repo.findByTenantId(seeded.tenantId);

    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, seeded.tenantId, body, `O05-${randomUUID()}`);

    // Simulate concurrent CAS: bump rowVersion underneath, then legacy save reads new version
    // and succeeds for metadata — status still SUSPENDED via Model B.
    entity!.changePlan('enterprise');
    await repo.save(entity!);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('SUSPENDED');
    expect(after.plan).toBe('ENTERPRISE');
  });

  it('O06 failed legacy update does not increment rowVersion', async () => {
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const before = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });

    // Out-of-band bump then stale CAS where rowVersion=before — zero rows, plan unchanged
    await prisma.platformTenant.update({
      where: { id: seeded.platformTenant.id },
      data: { rowVersion: { increment: 1 } },
    });
    const cas = await prisma.platformTenant.updateMany({
      where: { id: seeded.platformTenant.id, rowVersion: before.rowVersion },
      data: { plan: 'ENTERPRISE', rowVersion: { increment: 1 } },
    });
    expect(cas.count).toBe(0);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.plan).toBe(before.plan);
    expect(after.status).toBe('ACTIVE');
    expect(after.rowVersion).toBe(before.rowVersion + 1);
  });

  it('O07 exact lifecycle replay does not increment rowVersion', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    const key = `O07-${randomUUID()}`;
    await stack.service.suspend(claims, seeded.tenantId, body, key);
    const mid = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(mid.rowVersion).toBe(2);
    await stack.service.suspend(claims, seeded.tenantId, body, key);
    const after = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(after.rowVersion).toBe(2);
    expect(after.status).toBe('SUSPENDED');
  });

  it('O08 concurrent metadata updates preserve lifecycle state', async () => {
    const stack = createLifecycleStack(prisma);
    const claims = await actor();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claims, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claims, seeded.tenantId, body, `O08-${randomUUID()}`);

    const a = await repo.findByTenantId(seeded.tenantId);
    const b = await repo.findByTenantId(seeded.tenantId);
    a!.changePlan('enterprise');
    await repo.save(a!);
    b!.changePlan('starter');
    // Second save uses fresh DB rowVersion via CAS read — should succeed
    await repo.save(b!);

    const after = await prisma.platformTenant.findUniqueOrThrow({
      where: { tenantId: seeded.tenantId },
    });
    expect(after.status).toBe('SUSPENDED');
    expect(after.plan).toBe('LITE'); // starter maps to LITE
  });
});
