/**
 * Flexible Step 19 — Phase G: warmed/stale EER cache cannot preserve access after suspension.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  activateCommercialFixture,
  createRuntimeService,
  createSecondPlatformTenant,
} from '../../effective-entitlement-runtime/tests/effective-entitlement-runtime-db.harness';
import { ensurePlatformSubscriptionFixtures } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
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
  setLifecycleFailureInjection,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 19 warmed EER cache denial after suspension (PostgreSQL)', () => {
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

  it('G01 warmed allow cache + failed invalidation still denies after PlatformTenant SUSPENDED', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    const isolated = await createSecondPlatformTenant(prisma);
    const clinicTenantId = isolated.clinicTenantId;
    const runtime = createRuntimeService(prisma);

    await activateCommercialFixture({
      prisma,
      platformTenantId: isolated.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: `eer-warm-${randomUUID().slice(0, 8)}`,
    });

    const warmed = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(warmed.code).toBe('snapshot_resolved');
    expect((await runtime.canUseModule(clinicTenantId, 'module.dashboard')).allowed).toBe(true);

    const other = await seedClinicTenant(prisma, { status: 'ACTIVE', displayName: 'EER Other' });

    const stack = createLifecycleStack(prisma);
    const actor = await createPlatformUserFixture(prisma, {
      email: `eer-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const claims = platformClaims(actor.id, randomUUID());

    const ptBefore = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: isolated.platformTenantId },
    });
    const { body } = await previewAndBody(
      stack,
      claims,
      clinicTenantId,
      'suspend',
      ptBefore.rowVersion,
    );
    setLifecycleFailureInjection('F23');
    await expect(
      stack.service.suspend(claims, clinicTenantId, body, `eer-sus-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();

    const after = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.code).toBe('platform_tenant_suspended');
    expect(after.provenance).toBe('AUTHORITATIVE_SUSPENDED');
    expect(after.modules).toEqual([]);
    expect(after.source).not.toBe('LEGACY');

    const mod = await runtime.canUseModule(clinicTenantId, 'module.dashboard');
    expect(mod.allowed).toBe(false);
    expect(mod.code).toBe('platform_tenant_suspended');

    const lim = await runtime.getLimit(clinicTenantId, 'limit.max_users');
    expect(lim.state).not.toBe('UNLIMITED');

    expect(
      (await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: other.tenantId } })).status,
    ).toBe('ACTIVE');

    const sus = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: clinicTenantId } });
    expect(sus.status).toBe('SUSPENDED');
    const { body: reb } = await previewAndBody(
      stack,
      claims,
      clinicTenantId,
      'reactivate',
      sus.rowVersion,
    );
    setLifecycleFailureInjection('F24');
    await expect(
      stack.service.reactivate(claims, clinicTenantId, reb, `eer-re-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearLifecycleFailureInjection();
    expect(
      (await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: clinicTenantId } })).status,
    ).toBe('SUSPENDED');

    const still = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: clinicTenantId } });
    const { body: reb2 } = await previewAndBody(
      stack,
      claims,
      clinicTenantId,
      'reactivate',
      still.rowVersion,
    );
    await stack.service.reactivate(claims, clinicTenantId, reb2, `eer-ok-${randomUUID()}`);
    expect(
      (await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: clinicTenantId } })).status,
    ).toBe('ACTIVE');
    expect(
      (await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId: other.tenantId } })).status,
    ).toBe('ACTIVE');
  });
});
