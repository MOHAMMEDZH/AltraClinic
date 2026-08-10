/**
 * Step 17 Effective Entitlement Runtime — source-selection matrix (PostgreSQL).
 * Schema additions for Step 17/18 must remain zero; reuses Step 16 commercial tables only.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA } from '../../platform-subscriptions/domain/subscription-commercial-fingerprint';
import {
  activateCommercialFixture,
  assertSafePlatformTestDatabaseUrl,
  assertStep17SchemaUnchanged,
  ALL_SUBSCRIPTION_PERMS,
  claims,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  clinicTenantIdFor,
  createPlatformDbSecurityClient,
  createRuntimeService,
  createSecondPlatformTenant,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensurePlatformSubscriptionFixtures,
  platformDbSecurityEnabled,
  withAmbiguousCurrentAllowed,
} from './effective-entitlement-runtime-db.harness';
import { buildEffectiveEntitlementCacheKey } from '../application/effective-entitlement.cache';
import type { EffectiveEntitlementRuntimeService } from '../application/effective-entitlement-runtime.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 17 effective entitlement runtime source matrix (postgres)', () => {
  let prisma: PrismaClient;
  let runtime: EffectiveEntitlementRuntimeService;
  let fixtures: Awaited<ReturnType<typeof ensurePlatformSubscriptionFixtures>>;
  let clinicTenantId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    clinicTenantId = await clinicTenantIdFor(prisma, fixtures.platformTenantId);
    await assertStep17SchemaUnchanged(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    runtime = createRuntimeService(prisma);
  });

  it('documents zero schema additions for Step 17 / no Step 18 tables', async () => {
    await assertStep17SchemaUnchanged(prisma);
  });

  it('no Step 16 history → NEVER_MANAGED LEGACY', async () => {
    const bundle = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(bundle.source).toBe('LEGACY');
    expect(bundle.code).toBe('legacy_never_managed');
    expect(bundle.provenance).toBe('NEVER_MANAGED');
    expect(bundle.modules).toEqual([]);
  });

  it('valid ACTIVE_COMMERCIAL snapshot → SNAPSHOT', async () => {
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-active',
    });
    const bundle = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.code).toBe('snapshot_resolved');
    expect(bundle.provenance).toBe('AUTHORITATIVE_ACTIVE');
    expect(bundle.snapshotId).toBe(active.snapshotId);
    expect(bundle.fingerprint).toBe(active.fingerprint);
    expect(bundle.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(bundle.modules.length + bundle.features.length).toBeGreaterThan(0);

    const mod = bundle.modules[0]!;
    const decision = await runtime.canUseModule(clinicTenantId, mod);
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe('SNAPSHOT');
  });

  it('Draft / Scheduled before activation → deny pending (not legacy)', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();

    const draft = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId },
      's17-draft-create',
    );
    const assigned = await service.assignPlanVersion(
      actor,
      draft.id,
      {
        expectedRowVersion: draft.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      's17-draft-plan',
    );
    const afterDraft = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(afterDraft.source).toBe('SNAPSHOT');
    expect(afterDraft.code).toBe('runtime_pending_activation');
    expect(afterDraft.provenance).toBe('AUTHORITATIVE_PENDING_ACTIVATION');
    expect(afterDraft.modules).toEqual([]);

    await service.schedule(
      actor,
      draft.id,
      {
        expectedRowVersion: assigned.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 's17 schedule',
      },
      's17-sched',
    );
    const afterSched = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(afterSched.source).toBe('SNAPSHOT');
    expect(afterSched.code).toBe('runtime_pending_activation');
    expect(afterSched.modules).toEqual([]);
  });

  it('Suspended deny; cancel zero-current → TERMINAL deny (no legacy resurrection)', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      effectiveEntitlements: runtime,
    });
    const actor = claims();
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-deny',
    });

    const allowed = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(allowed.code).toBe('snapshot_resolved');

    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.configId },
    });
    await service.suspend(
      actor,
      active.configId,
      { expectedRowVersion: row.rowVersion, reason: 's17 suspend' },
      's17-sus',
    );
    const suspended = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(suspended.source).toBe('SNAPSHOT');
    expect(suspended.code).toBe('runtime_suspended');
    expect(suspended.provenance).toBe('AUTHORITATIVE_SUSPENDED');
    expect(suspended.modules).toEqual([]);

    const susRow = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.configId },
    });
    await service.cancel(
      actor,
      active.configId,
      { expectedRowVersion: susRow.rowVersion, reason: 's17 cancel' },
      's17-cancel',
    );
    // Step 16 clears isCurrent — must TERMINAL deny, never legacy resurrection.
    const cancelled = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(cancelled.source).toBe('SNAPSHOT');
    expect(cancelled.code).toBe('runtime_terminal');
    expect(cancelled.provenance).toBe('AUTHORITATIVE_TERMINAL');
    expect(cancelled.modules).toEqual([]);
    const modDenied = await runtime.canUseModule(clinicTenantId, 'module.dashboard');
    expect(modDenied.allowed).toBe(false);
    expect(modDenied.code).toBe('runtime_terminal');
    const lim = await runtime.getLimit(clinicTenantId, 'limit.max_users');
    expect(lim.state).toBe('UNCONFIGURED');
    expect(lim.code).toBe('runtime_terminal');
  });

  it('ambiguous current → fail closed', async () => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-amb-a',
    });

    await withAmbiguousCurrentAllowed(prisma, async () => {
      await prisma.platformSubscriptionCommercialConfig.create({
        data: {
          id: randomUUID(),
          platformTenantId: fixtures.platformTenantId,
          lifecycle: 'DRAFT',
          isCurrent: true,
          rowVersion: 1,
          createdByPlatformUserId: randomUUID(),
        },
      });
      runtime = createRuntimeService(prisma);
      const bundle = await runtime.resolveEffectiveEntitlements(clinicTenantId);
      expect(bundle.source).toBe('SNAPSHOT');
      expect(bundle.code).toBe('current_configuration_ambiguous');
      expect(bundle.modules).toEqual([]);
    });
  });

  it('malformed / fingerprint mismatch → fail closed (no silent legacy)', async () => {
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-mal',
    });

    await prisma.platformSubscriptionCommercialSnapshot.update({
      where: { id: active.snapshotId },
      data: {
        snapshotPayload: {
          schema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
          broken: true,
        },
      },
    });
    runtime.invalidateTenant(clinicTenantId);
    const malformed = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(malformed.source).toBe('SNAPSHOT');
    expect(malformed.code).not.toMatch(/^legacy_/);
    expect([
      'snapshot_malformed',
      'snapshot_plan_missing',
      'snapshot_tenant_mismatch',
      'snapshot_fingerprint_missing',
      'snapshot_fingerprint_mismatch',
      'snapshot_plan_version_missing',
    ]).toContain(malformed.code);

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const fresh = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-fp2',
    });
    await prisma.platformSubscriptionCommercialSnapshot.update({
      where: { id: fresh.snapshotId },
      data: { fingerprint: 'd'.repeat(64) },
    });
    runtime = createRuntimeService(prisma);
    const mismatch = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(mismatch.source).toBe('SNAPSHOT');
    expect(mismatch.code).toBe('snapshot_fingerprint_mismatch');
  });

  it('Draft mutation does not change active cached decision', async () => {
    const actor = claims();
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-cache-draft',
    });

    const before = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(before.source).toBe('SNAPSHOT');
    expect(before.code).toBe('snapshot_resolved');
    expect(before.fingerprint).toBe(active.fingerprint);

    // Non-current Draft mutation must not affect active SNAPSHOT cache identity.
    const orphanDraft = await prisma.platformSubscriptionCommercialConfig.create({
      data: {
        id: randomUUID(),
        platformTenantId: fixtures.platformTenantId,
        lifecycle: 'DRAFT',
        isCurrent: false,
        rowVersion: 1,
        planVersionId: fixtures.publishedPlanVersionId,
        commercialStart: new Date('2099-01-01T00:00:00.000Z'),
        createdByPlatformUserId: actor.sub,
      },
    });
    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: orphanDraft.id },
      data: {
        commercialEnd: new Date('2099-12-31T00:00:00.000Z'),
        rowVersion: { increment: 1 },
      },
    });

    const after = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.source).toBe('SNAPSHOT');
    expect(after.code).toBe('snapshot_resolved');
    expect(after.snapshotId).toBe(before.snapshotId);
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(after.configId).toBe(active.configId);
  });

  it('activation invalidates / changes cache key identity', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();
    const first = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-act-key',
    });
    const before = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    const keyBefore = buildEffectiveEntitlementCacheKey({
      tenantId: clinicTenantId,
      provenance: before.provenance ?? 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      lifecycle: before.lifecycle,
      snapshotId: before.snapshotId,
      fingerprint: before.fingerprint,
    });
    expect(keyBefore).toContain(first.snapshotId);

    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: first.configId },
    });
    const successor = await service.renew(
      actor,
      first.configId,
      {
        expectedRowVersion: pred.rowVersion,
        reason: 's17 successor',
        renewalEffectiveAt: '2030-01-01T00:00:00.000Z',
      },
      's17-succ-renew',
    );
    // Successor Draft must keep predecessor snapshot runtime-effective (no legacy).
    const duringHandoff = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(duringHandoff.source).toBe('SNAPSHOT');
    expect(duringHandoff.code).toBe('snapshot_resolved');
    expect(duringHandoff.provenance).toBe('AUTHORITATIVE_PENDING_SUCCESSOR');
    expect(duringHandoff.snapshotId).toBe(before.snapshotId);

    let rowVersion = successor.rowVersion;
    if (!successor.planVersionId) {
      const assigned = await service.assignPlanVersion(
        actor,
        successor.id,
        {
          expectedRowVersion: successor.rowVersion,
          planVersionId: fixtures.publishedPlanVersionId,
        },
        's17-succ-plan',
      );
      rowVersion = assigned.rowVersion;
    }
    const activated = await service.activate(
      actor,
      successor.id,
      {
        expectedRowVersion: rowVersion,
        reason: 's17 successor activate',
      },
      's17-succ-act',
    );
    expect(activated.lifecycle).toBe('ACTIVE_COMMERCIAL');

    const after = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.source).toBe('SNAPSHOT');
    expect(after.code).toBe('snapshot_resolved');
    expect(after.provenance).toBe('AUTHORITATIVE_ACTIVE');
    expect(after.snapshotId).not.toBe(before.snapshotId);
    const keyAfter = buildEffectiveEntitlementCacheKey({
      tenantId: clinicTenantId,
      provenance: after.provenance ?? 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      lifecycle: after.lifecycle,
      snapshotId: after.snapshotId,
      fingerprint: after.fingerprint,
    });
    expect(keyAfter).not.toBe(keyBefore);
  });

  it('cross-tenant isolation', async () => {
    const other = await createSecondPlatformTenant(prisma);
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-iso-a',
    });
    await activateCommercialFixture({
      prisma,
      platformTenantId: other.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-iso-b',
    });

    const a = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    const b = await runtime.resolveEffectiveEntitlements(other.clinicTenantId);
    expect(a.source).toBe('SNAPSHOT');
    expect(b.source).toBe('SNAPSHOT');
    expect(a.tenantId).toBe(clinicTenantId);
    expect(b.tenantId).toBe(other.clinicTenantId);
    expect(a.configId).not.toBe(b.configId);
    expect(a.snapshotId).not.toBe(b.snapshotId);

    runtime.invalidateTenant(clinicTenantId);
    const a2 = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    const b2 = await runtime.resolveEffectiveEntitlements(other.clinicTenantId);
    expect(a2.configId).toBe(a.configId);
    expect(b2.configId).toBe(b.configId);
  });
});
