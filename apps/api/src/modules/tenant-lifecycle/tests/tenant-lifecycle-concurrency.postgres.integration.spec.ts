/**
 * Flexible Step 19 — PostgreSQL concurrency matrix C01–C25.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
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

async function settled(promises: Promise<unknown>[]) {
  return Promise.allSettled(promises);
}

describeDb('Step 19 concurrency matrix C01-C25 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableLifecycleFlag();
  });

  afterAll(async () => {
    restoreFlag();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearLifecycleFailureInjection();
    await cleanupLifecycleTables(prisma);
  });

  afterEach(() => clearLifecycleFailureInjection());

  async function actors() {
    const a = await createPlatformUserFixture(prisma, {
      email: `c-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const b = await createPlatformUserFixture(prisma, {
      email: `c-b-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    return {
      a,
      b,
      claimsA: platformClaims(a.id, randomUUID()),
      claimsB: platformClaims(b.id, randomUUID()),
    };
  }

  it('C01 activate versus activate — one winner', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'PROVISIONING' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'activate', 1);
    const results = await settled([
      stack.service.activate(claimsA, seeded.tenantId, body, `c01a-${randomUUID()}`),
      stack.service.activate(claimsB, seeded.tenantId, body, `c01b-${randomUUID()}`),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status).toBe('ACTIVE');
    expect(pt.rowVersion).toBe(2);
  });

  it('C02 suspend versus suspend — one winner', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    const results = await settled([
      stack.service.suspend(claimsA, seeded.tenantId, body, `c02a-${randomUUID()}`),
      stack.service.suspend(claimsB, seeded.tenantId, body, `c02b-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status).toBe('SUSPENDED');
    expect(pt.rowVersion).toBe(2);
  });

  it('C03 reactivate versus reactivate — one winner', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'reactivate', 1);
    const results = await settled([
      stack.service.reactivate(claimsA, seeded.tenantId, body, `c03a-${randomUUID()}`),
      stack.service.reactivate(claimsB, seeded.tenantId, body, `c03b-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status).toBe('ACTIVE');
  });

  it('C04 activate versus suspend — activate only from PROVISIONING', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'PROVISIONING' });
    const act = await previewAndBody(stack, claimsA, seeded.tenantId, 'activate', 1);
    const sus = await previewAndBody(stack, claimsB, seeded.tenantId, 'suspend', 1);
    const results = await settled([
      stack.service.activate(claimsA, seeded.tenantId, act.body, `c04a-${randomUUID()}`),
      stack.service.suspend(claimsB, seeded.tenantId, sus.body, `c04b-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(['ACTIVE', 'PROVISIONING']).toContain(pt.status);
  });

  it('C05 suspend versus reactivate', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const sus = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claimsA, seeded.tenantId, sus.body, `c05s-${randomUUID()}`);
    const after = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    const rea = await previewAndBody(stack, claimsB, seeded.tenantId, 'reactivate', after.rowVersion);
    await stack.service.reactivate(claimsB, seeded.tenantId, rea.body, `c05r-${randomUUID()}`);
    const final = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(final.status).toBe('ACTIVE');
  });

  it('C06 suspend versus archive request', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const sus = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    const arc = await previewAndBody(stack, claimsB, seeded.tenantId, 'archive_request', 1);
    const results = await settled([
      stack.service.suspend(claimsA, seeded.tenantId, sus.body, `c06s-${randomUUID()}`),
      stack.service.createArchiveRequest(claimsB, seeded.tenantId, arc.body, `c06a-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  });

  it('C07 reactivate versus archive request', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    const rea = await previewAndBody(stack, claimsA, seeded.tenantId, 'reactivate', 1);
    const arc = await previewAndBody(stack, claimsB, seeded.tenantId, 'archive_request', 1);
    await settled([
      stack.service.reactivate(claimsA, seeded.tenantId, rea.body, `c07r-${randomUUID()}`),
      stack.service.createArchiveRequest(claimsB, seeded.tenantId, arc.body, `c07a-${randomUUID()}`),
    ]);
    const pending = await prisma.platformTenantLifecycleRequest.count({
      where: { tenantId: seeded.tenantId, status: 'PENDING' },
    });
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status === 'ACTIVE' || pending === 1).toBe(true);
  });

  it('C08 archive request versus deletion request — deletion requires ARCHIVED', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, {
      status: 'ACTIVE',
      displayName: 'C08 Clinic',
    });
    const arc = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const delPreview = await stack.service.preview(claimsB, seeded.tenantId, 'deletion_request');
    expect(delPreview.blockers.length).toBeGreaterThan(0);
    await stack.service.createArchiveRequest(claimsA, seeded.tenantId, arc.body, `c08-${randomUUID()}`);
    const pending = await prisma.platformTenantLifecycleRequest.count({
      where: { tenantId: seeded.tenantId, type: 'ARCHIVE', status: 'PENDING' },
    });
    expect(pending).toBe(1);
  });

  it('C09 duplicate archive request — one pending', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const results = await settled([
      stack.service.createArchiveRequest(claimsA, seeded.tenantId, body, `c09a-${randomUUID()}`),
      stack.service.createArchiveRequest(claimsB, seeded.tenantId, body, `c09b-${randomUUID()}`),
    ]);
    const pending = await prisma.platformTenantLifecycleRequest.count({
      where: { tenantId: seeded.tenantId, type: 'ARCHIVE', status: 'PENDING' },
    });
    expect(pending).toBe(1);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
  });

  it('C10 duplicate deletion request — one pending', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'C10 Clinic',
    });
    const { body } = await previewAndBody(
      stack,
      claimsA,
      seeded.tenantId,
      'deletion_request',
      1,
      { typedConfirmation: seeded.displayName },
    );
    const results = await settled([
      stack.service.createDeletionRequest(claimsA, seeded.tenantId, body, `c10a-${randomUUID()}`),
      stack.service.createDeletionRequest(claimsB, seeded.tenantId, body, `c10b-${randomUUID()}`),
    ]);
    const pending = await prisma.platformTenantLifecycleRequest.count({
      where: { tenantId: seeded.tenantId, type: 'DELETE', status: 'PENDING' },
    });
    expect(pending).toBe(1);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
  });

  it('C11 approval versus approval — one winner', async () => {
    const stack = createLifecycleStack(prisma);
    const { a, claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const req = (await stack.service.createArchiveRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c11c-${randomUUID()}`,
    )) as { id: string };
    // use third actor as requester already a — approvals by A and B both try (A is requester so denied)
    const third = await createPlatformUserFixture(prisma, {
      email: `c11c-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claimsC = platformClaims(third.id, randomUUID());
    const results = await settled([
      stack.service.approveRequest(
        claimsB,
        req.id,
        { expectedRowVersion: 1, reason: 'apr', previewFingerprint: 'n/a' },
        `c11b-${randomUUID()}`,
      ),
      stack.service.approveRequest(
        claimsC,
        req.id,
        { expectedRowVersion: 1, reason: 'apr', previewFingerprint: 'n/a' },
        `c11c2-${randomUUID()}`,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    void a;
  });

  it('C12 approval versus rejection', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const third = await createPlatformUserFixture(prisma, {
      email: `c12-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claimsC = platformClaims(third.id, randomUUID());
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const req = (await stack.service.createArchiveRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c12c-${randomUUID()}`,
    )) as { id: string };
    const results = await settled([
      stack.service.approveRequest(
        claimsB,
        req.id,
        { expectedRowVersion: 1, reason: 'apr', previewFingerprint: 'n/a' },
        `c12a-${randomUUID()}`,
      ),
      stack.service.rejectRequest(
        claimsC,
        req.id,
        { expectedRowVersion: 1, reason: 'rej', previewFingerprint: 'n/a' },
        `c12r-${randomUUID()}`,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C13 approval versus cancellation', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const req = (await stack.service.createArchiveRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c13c-${randomUUID()}`,
    )) as { id: string };
    const results = await settled([
      stack.service.approveRequest(
        claimsB,
        req.id,
        { expectedRowVersion: 1, reason: 'apr', previewFingerprint: 'n/a' },
        `c13a-${randomUUID()}`,
      ),
      stack.service.cancelRequest(
        claimsA,
        req.id,
        { expectedRowVersion: 1, reason: 'can', previewFingerprint: 'n/a' },
        `c13x-${randomUUID()}`,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C14 action versus stale rowVersion', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await expect(
      stack.service.suspend(
        claimsA,
        seeded.tenantId,
        { ...body, expectedRowVersion: 0 },
        `c14-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'stale_row_version' } });
  });

  it('C15 action versus Step 16 subscription status change — commercial block on reactivate', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    await prisma.platformTenantProvisioningRequest.create({
      data: {
        id: randomUUID(),
        status: 'COMPLETED',
        organizationName: seeded.displayName,
        facilityTypeKey: 'clinic.general',
        specialtyKeys: [],
        publishedPlanVersionId: randomUUID(),
        adminEmail: 'admin@example.com',
        onboardingType: 'standard',
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenant.id,
        reservedSlug: seeded.slug,
        region: 'ME_SOUTH',
        correlationId: randomUUID(),
        createdByPlatformUserId: randomUUID(),
        completedAt: new Date(),
        rowVersion: 1,
      },
    });
    await prisma.platformSubscriptionCommercialConfig.create({
      data: {
        id: randomUUID(),
        platformTenantId: seeded.platformTenant.id,
        lifecycle: 'CANCELLED',
        isCurrent: true,
        createdByPlatformUserId: randomUUID(),
      },
    });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'reactivate', 1);
    await expect(
      stack.service.reactivate(claimsA, seeded.tenantId, body, `c15-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'commercial_ineligible' });
  });

  it('C16 reactivation versus EER snapshot identity change — Legacy blocked for managed', async () => {
    const stack = createLifecycleStack(prisma, { eerSource: 'LEGACY' });
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'SUSPENDED' });
    await prisma.platformTenantProvisioningRequest.create({
      data: {
        id: randomUUID(),
        status: 'COMPLETED',
        organizationName: seeded.displayName,
        facilityTypeKey: 'clinic.general',
        specialtyKeys: [],
        publishedPlanVersionId: randomUUID(),
        adminEmail: 'admin@example.com',
        onboardingType: 'standard',
        tenantId: seeded.tenantId,
        platformTenantId: seeded.platformTenant.id,
        reservedSlug: seeded.slug,
        region: 'ME_SOUTH',
        correlationId: randomUUID(),
        createdByPlatformUserId: randomUUID(),
        completedAt: new Date(),
        rowVersion: 1,
      },
    });
    const cfgId = randomUUID();
    await prisma.platformSubscriptionCommercialConfig.create({
      data: {
        id: cfgId,
        platformTenantId: seeded.platformTenant.id,
        lifecycle: 'ACTIVE_COMMERCIAL',
        isCurrent: true,
        createdByPlatformUserId: randomUUID(),
      },
    });
    await prisma.platformSubscriptionCommercialSnapshot.create({
      data: {
        id: randomUUID(),
        configId: cfgId,
        fingerprint: 'abc',
        fingerprintSchemaVersion: 'v1',
        snapshotPayload: { modules: [] },
      },
    });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'reactivate', 1);
    await expect(
      stack.service.reactivate(claimsA, seeded.tenantId, body, `c16-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'eer_legacy_forbidden' });
  });

  it('C17 suspension versus session refresh — revokeAllByTenantId invoked', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claimsA, seeded.tenantId, body, `c17-${randomUUID()}`);
    expect(stack.revokedTenantIds).toEqual([seeded.tenantId]);
  });

  it('C18 suspension versus Clinic login — status is SUSPENDED', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await stack.service.suspend(claimsA, seeded.tenantId, body, `c18-${randomUUID()}`);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: seeded.tenantId } });
    expect(pt.status).toBe('SUSPENDED');
  });

  it('C19 notification dispatch versus replay — one event', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    const key = `c19-${randomUUID()}`;
    await stack.service.suspend(claimsA, seeded.tenantId, body, key);
    await stack.service.suspend(claimsA, seeded.tenantId, body, key);
    expect(stack.publishedEvents).toHaveLength(1);
  });

  it('C20 target tenant action versus another tenant action', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const t1 = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const t2 = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const b1 = await previewAndBody(stack, claimsA, t1.tenantId, 'suspend', 1);
    const b2 = await previewAndBody(stack, claimsB, t2.tenantId, 'suspend', 1);
    await Promise.all([
      stack.service.suspend(claimsA, t1.tenantId, b1.body, `c20a-${randomUUID()}`),
      stack.service.suspend(claimsB, t2.tenantId, b2.body, `c20b-${randomUUID()}`),
    ]);
    const p1 = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: t1.tenantId } });
    const p2 = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: t2.tenantId } });
    expect(p1.status).toBe('SUSPENDED');
    expect(p2.status).toBe('SUSPENDED');
  });

  it('C21 lifecycle action versus legacy tenant status handler rowVersion bump', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    await prisma.platformTenant.update({
      where: { id: seeded.platformTenant.id },
      data: { rowVersion: { increment: 1 } },
    });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await expect(
      stack.service.suspend(claimsA, seeded.tenantId, body, `c21-${randomUUID()}`),
    ).rejects.toMatchObject({ response: { code: 'stale_row_version' } });
  });

  it('C22 lifecycle action versus Tenant Directory update — OCC safe', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'suspend', 1);
    await prisma.platformTenant.update({
      where: { id: seeded.platformTenant.id },
      data: { rowVersion: { increment: 1 } },
    });
    await expect(
      stack.service.suspend(claimsA, seeded.tenantId, body, `c22-${randomUUID()}`),
    ).rejects.toMatchObject({ response: { code: expect.stringMatching(/stale_row_version|preview_stale/) } });
  });

  it('C23 archive requester versus self-approval', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    const { body } = await previewAndBody(stack, claimsA, seeded.tenantId, 'archive_request', 1);
    const req = (await stack.service.createArchiveRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c23-${randomUUID()}`,
    )) as { id: string };
    await expect(
      stack.service.approveRequest(
        claimsA,
        req.id,
        { expectedRowVersion: 1, reason: 'self', previewFingerprint: 'n/a' },
        `c23a-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'self_approval_denied' } });
  });

  it('C24 deletion requester versus self-approval', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA } = await actors();
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'C24 Clinic',
    });
    const { body } = await previewAndBody(
      stack,
      claimsA,
      seeded.tenantId,
      'deletion_request',
      1,
      { typedConfirmation: seeded.displayName },
    );
    const req = (await stack.service.createDeletionRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c24-${randomUUID()}`,
    )) as { id: string };
    await expect(
      stack.service.approveRequest(
        claimsA,
        req.id,
        { expectedRowVersion: 1, reason: 'self', previewFingerprint: 'n/a' },
        `c24a-${randomUUID()}`,
      ),
    ).rejects.toMatchObject({ response: { code: 'self_approval_denied' } });
  });

  it('C25 cancellation versus execution handoff', async () => {
    const stack = createLifecycleStack(prisma);
    const { claimsA, claimsB } = await actors();
    const seeded = await seedClinicTenant(prisma, {
      status: 'ARCHIVED',
      displayName: 'C25 Clinic',
    });
    const { body } = await previewAndBody(
      stack,
      claimsA,
      seeded.tenantId,
      'deletion_request',
      1,
      { typedConfirmation: seeded.displayName },
    );
    const req = (await stack.service.createDeletionRequest(
      claimsA,
      seeded.tenantId,
      body,
      `c25-${randomUUID()}`,
    )) as { id: string };
    const results = await settled([
      stack.service.approveRequest(
        claimsB,
        req.id,
        { expectedRowVersion: 1, reason: 'handoff', previewFingerprint: 'n/a' },
        `c25a-${randomUUID()}`,
      ),
      stack.service.cancelRequest(
        claimsA,
        req.id,
        { expectedRowVersion: 1, reason: 'cancel', previewFingerprint: 'n/a' },
        `c25c-${randomUUID()}`,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const still = await prisma.platformTenant.findUnique({ where: { tenantId: seeded.tenantId } });
    expect(still).not.toBeNull();
  });
});
