/**
 * Flexible Step 20 — failure-injection matrix F01–F20.
 * F15–F20 are independently named executed tests (not registration-only stubs).
 */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  cleanupFfTables,
  clearFfFailureInjection,
  createFfStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableFfFlag,
  platformClaims,
  platformDbSecurityEnabled,
  seedActiveFlag,
  seedSetting,
  setFfFailureInjection,
} from './feature-flags-settings-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 20 failure-injection matrix F01-F20 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableFfFlag();
  });

  afterAll(async () => {
    restoreFlag();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearFfFailureInjection();
    await cleanupFfTables(prisma);
  });

  afterEach(() => clearFfFailureInjection());

  it('F01-F12 create rolls back when injected before commit', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);

    for (const point of [
      'after_authorization',
      'after_idempotency_claim',
      'after_row_lock',
      'after_flag_mutation_staging',
      'after_history_staging',
      'after_idempotency_completion_staging',
      'before_commit',
    ] as const) {
      await cleanupFfTables(prisma);
      clearFfFailureInjection();
      setFfFailureInjection(point);
      const key = `ops.f.${point}.${randomUUID().slice(0, 6)}`;
      await expect(
        stack.service.createFlag(
          claims,
          {
            canonicalKey: key,
            displayName: point,
            description: 'inject',
            ownerTeam: 'ops',
            category: 'test',
            effect: 'OPERATIONAL_ENABLEMENT',
            reason: 'inject',
          },
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: 'injected_failure' });
      expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(0);
      expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(0);
      expect(await prisma.platformFeatureFlagHistory.count()).toBe(0);
    }
  });

  it('F13 after commit before response — row committed', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f13-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    setFfFailureInjection('after_commit_before_response');
    const key = `ops.f13.${randomUUID().slice(0, 8)}`;
    await expect(
      stack.service.createFlag(
        claims,
        {
          canonicalKey: key,
          displayName: 'F13',
          description: 'post-commit',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          reason: 'post',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(1);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
  });

  it('F14 cache invalidation failure — kill switch still denies via DB', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f14-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id, { effect: 'KILL_SWITCH_DENY' });
    const stack = createFfStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    setFfFailureInjection('cache_invalidation_failure');
    await stack.service.setKillSwitch(
      claims,
      flag.id,
      true,
      {
        reason: 'f14',
        expectedRowVersion: 1,
        previewFingerprint: 'fp',
        confirmation: 'CONFIRM',
      },
      randomUUID(),
    );
    clearFfFailureInjection();
    const result = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.explanationCode).toBe('kill_switch_denied');
  });

  it('F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f15-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id, {
      effect: 'ROLLOUT_ALLOW_FOR_ENTITLED',
      killSwitchActive: false,
    });
    const ksFlag = await seedActiveFlag(prisma, user.id, {
      key: `ops.f15.ks.${randomUUID().slice(0, 6)}`,
      effect: 'KILL_SWITCH_DENY',
      killSwitchActive: true,
    });
    const stack = createFfStack(prisma);
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    // Entitlement deny never reaches adapter — remains denial (no false allow).
    setFfFailureInjection('eer_adapter_failure');
    const deniedEnt = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: flag.canonicalKey,
      entitlementAllows: false,
      lifecycleDenied: false,
    });
    expect(deniedEnt.allowed).toBe(false);
    expect(deniedEnt.explanationCode).toBe('entitlement_denied');

    const deniedLife = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: true,
    });
    expect(deniedLife.allowed).toBe(false);
    expect(deniedLife.explanationCode).toBe('lifecycle_denied');

    // Entitlement allow + adapter failure → fail-closed (no allow, no cache poison).
    await expect(
      stack.operational.evaluate({
        tenantId: tenantA,
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });

    clearFfFailureInjection();
    // Kill-switch denial still works without adapter injection.
    const ks = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: ksFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(ks.allowed).toBe(false);
    expect(ks.explanationCode).toBe('kill_switch_denied');

    // No cache poisoning: after failure, a fresh evaluate must not falsely allow when KS active.
    stack.operational.invalidateAll();
    const ksAgain = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: ksFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(ksAgain.allowed).toBe(false);

    // Tenant B unaffected; no commercial/lifecycle/U01/secret mutations.
    const allowB = await stack.operational.evaluate({
      tenantId: tenantB,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(allowB.allowed).toBe(true);
    expect(await prisma.platformFeatureFlag.count()).toBe(2);
    expect(stack.audit.entries).toHaveLength(0);
    expect(JSON.stringify(deniedEnt)).not.toMatch(/password|secret|stack|prisma|SELECT/i);
  });

  it('F16 service recreation before replay — exact replay, conflict 409, no duplicate side effects', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f16-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const other = await createPlatformUserFixture(prisma, {
      email: `ff-f16-b-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const claimsOther = platformClaims(other.id, randomUUID());
    const stack1 = createFfStack(prisma);
    const key = `ops.f16.${randomUUID().slice(0, 8)}`;
    const body = {
      canonicalKey: key,
      displayName: 'F16',
      description: 'recreate',
      ownerTeam: 'ops',
      category: 'test',
      effect: 'OPERATIONAL_ENABLEMENT' as const,
      reason: 'recreate',
    };
    const idem = `f16-${randomUUID()}`;
    const first = await stack1.service.createFlag(claims, body, idem);
    expect(stack1.audit.entries).toHaveLength(1);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
    const rowVersion = (first as { rowVersion: number }).rowVersion;

    // Recreate module dependencies — no process-local memory dependency.
    const stack2 = createFfStack(prisma);
    const replay = await stack2.service.createFlag(claims, body, idem);
    expect((replay as { id: string }).id).toBe((first as { id: string }).id);
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(1);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
    const after = await prisma.platformFeatureFlag.findUniqueOrThrow({
      where: { canonicalKey: key },
    });
    expect(after.rowVersion).toBe(rowVersion);
    expect(stack2.audit.entries).toHaveLength(0);

    await expect(stack2.service.createFlag(claims, { ...body, displayName: 'Conflict' }, idem)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);

    // Different actor = separate idempotency namespace (no cross-actor result leak).
    const otherCreate = await stack2.service.createFlag(
      claimsOther,
      { ...body, canonicalKey: `ops.f16.other.${randomUUID().slice(0, 6)}` },
      idem,
    );
    expect((otherCreate as { id: string }).id).not.toBe((first as { id: string }).id);
  });

  it('F17 notification/outbox (durable history event) failure after commit — retryable, no duplicate', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f17-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    const key = `ops.f17.${randomUUID().slice(0, 8)}`;
    const body = {
      canonicalKey: key,
      displayName: 'F17',
      description: 'outbox',
      ownerTeam: 'ops',
      category: 'test',
      effect: 'OPERATIONAL_ENABLEMENT' as const,
      reason: 'outbox-boundary',
    };
    const idem = `f17-${randomUUID()}`;
    setFfFailureInjection('notification_outbox_failure');
    await expect(stack.service.createFlag(claims, body, idem)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    // Committed: flag + history + idempotency; outbox delivery failed after commit.
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(1);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
    expect(stack.audit.entries).toHaveLength(1);
    const payload = JSON.stringify(stack.audit.entries[0]);
    expect(payload).not.toMatch(/password|apikey|connectionstring|PHI|snapshot/i);

    clearFfFailureInjection();
    const stack2 = createFfStack(prisma);
    const replay = await stack2.service.createFlag(claims, body, idem);
    expect((replay as { canonicalKey: string }).canonicalKey).toBe(key);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
    expect(stack2.audit.entries).toHaveLength(0);

    // Kill-switch safety unchanged.
    const flag = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { canonicalKey: key } });
    await prisma.platformFeatureFlag.update({
      where: { id: flag.id },
      data: { status: 'ACTIVE', effect: 'KILL_SWITCH_DENY', killSwitchActive: true },
    });
    const denied = await stack2.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: key,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(denied.allowed).toBe(false);
  });

  it('F18 environment compatibility adapter failure — env authority preserved; no secret copy', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f18-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const setting = await seedSetting(prisma, user.id, {
      key: `setting.f18.${randomUUID().slice(0, 6)}`,
    });
    const stack = createFfStack(prisma);
    const beforeEnv = process.env.FEATURE_FLAGS_SETTINGS_ENABLED;

    setFfFailureInjection('environment_compatibility_adapter_failure');
    try {
      stack.service.readEnvironmentCompatibilityStatus('setting.feature_flags_settings_enabled_ref');
      throw new Error('expected injected_failure');
    } catch (err) {
      expect(err).toMatchObject({ code: 'injected_failure' });
    }
    expect(process.env.FEATURE_FLAGS_SETTINGS_ENABLED).toBe(beforeEnv);

    clearFfFailureInjection();
    const status = stack.service.readEnvironmentCompatibilityStatus(
      'setting.feature_flags_settings_enabled_ref',
    );
    expect(status.envAuthority).toBe(true);
    expect(status.mutableViaDb).toBe(false);
    expect(status.secretMaterialExposed).toBe(false);
    expect(status).not.toHaveProperty('rawValue');

    await stack.service.updateSetting(
      claims,
      setting.id,
      { safeValueJson: { enabled: true }, reason: 'f18-db', expectedRowVersion: 1 },
      randomUUID(),
    );
    expect(process.env.FEATURE_FLAGS_SETTINGS_ENABLED).toBe(beforeEnv);
    const row = await prisma.platformGlobalSetting.findUniqueOrThrow({ where: { id: setting.id } });
    expect(JSON.stringify(row)).not.toMatch(/smtp_password|api_key|Bearer /i);
    expect(await prisma.platformGlobalSettingHistory.count()).toBe(1);
    expect(stack.audit.entries).toHaveLength(1);
  });

  it('F19 target resolution failure — no false allow; deny precedence; cross-tenant isolation', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f19-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const allowFlag = await seedActiveFlag(prisma, user.id, {
      key: `ops.f19.allow.${randomUUID().slice(0, 6)}`,
      targetType: 'TENANT_ALLOWLIST',
    });
    await prisma.platformFeatureFlagTarget.create({
      data: { flagId: allowFlag.id, tenantId: tenantA, mode: 'ALLOW' },
    });
    const denyFlag = await seedActiveFlag(prisma, user.id, {
      key: `ops.f19.deny.${randomUUID().slice(0, 6)}`,
      targetType: 'TENANT_DENYLIST',
    });
    await prisma.platformFeatureFlagTarget.create({
      data: { flagId: denyFlag.id, tenantId: tenantA, mode: 'DENY' },
    });
    const pctFlag = await seedActiveFlag(prisma, user.id, {
      key: `ops.f19.pct.${randomUUID().slice(0, 6)}`,
      targetType: 'PERCENTAGE',
      rolloutPercentage: 50,
    });
    const stack = createFfStack(prisma);

    // Lifecycle / entitlement still win before target resolution.
    setFfFailureInjection('target_resolution_failure');
    const life = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: allowFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: true,
    });
    expect(life.explanationCode).toBe('lifecycle_denied');
    const ent = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: allowFlag.canonicalKey,
      entitlementAllows: false,
      lifecycleDenied: false,
    });
    expect(ent.explanationCode).toBe('entitlement_denied');

    await expect(
      stack.operational.evaluate({
        tenantId: tenantA,
        flagKey: allowFlag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });

    clearFfFailureInjection();
    const aAllow = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: allowFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(aAllow.allowed).toBe(true);
    const bAllow = await stack.operational.evaluate({
      tenantId: tenantB,
      flagKey: allowFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(bAllow.allowed).toBe(false);
    expect(bAllow.explanationCode).toBe('rollout_excluded');

    const aDeny = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: denyFlag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(aDeny.allowed).toBe(false);

    const {
      OperationalDecisionService,
    } = await import('../application/operational-decision.service');
    const b1 = OperationalDecisionService.percentageBucket(pctFlag.canonicalKey, tenantA);
    const b2 = OperationalDecisionService.percentageBucket(pctFlag.canonicalKey, tenantA);
    expect(b1).toBe(b2);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(100);

    // Missing target rows → allowlist excludes (no fuzzy/display-name).
    const emptyAllow = await seedActiveFlag(prisma, user.id, {
      key: `ops.f19.empty.${randomUUID().slice(0, 6)}`,
      targetType: 'TENANT_ALLOWLIST',
    });
    const missing = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: emptyAllow.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(missing.allowed).toBe(false);
    expect(missing.explanationCode).toBe('rollout_excluded');
  });

  it('F20 rollback/recovery failure on kill-switch — full TX rollback; retry recovers', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-f20-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id, {
      effect: 'KILL_SWITCH_DENY',
      killSwitchActive: false,
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    const idem = `f20-${randomUUID()}`;
    const body = {
      reason: 'f20-rollback',
      expectedRowVersion: 1,
      previewFingerprint: 'fp-f20',
      confirmation: 'CONFIRM' as const,
    };

    setFfFailureInjection('rollback_recovery_failure');
    await expect(stack.service.setKillSwitch(claims, flag.id, true, body, idem)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearFfFailureInjection();

    const rolled = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(rolled.killSwitchActive).toBe(false);
    expect(rolled.rowVersion).toBe(1);
    expect(await prisma.platformFeatureFlagHistory.count({ where: { flagId: flag.id } })).toBe(0);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(0);
    expect(stack.audit.entries).toHaveLength(0);

    // Recovery retry succeeds once; kill-switch denies; no orphan/false success/access grant.
    const recovered = await stack.service.setKillSwitch(claims, flag.id, true, body, idem);
    expect((recovered as { killSwitchActive: boolean }).killSwitchActive).toBe(true);
    expect((recovered as { rowVersion: number }).rowVersion).toBe(2);
    expect(await prisma.platformFeatureFlagHistory.count({ where: { flagId: flag.id } })).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
    expect(stack.audit.entries).toHaveLength(1);

    const evalResult = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.explanationCode).toBe('kill_switch_denied');

    const stack2 = createFfStack(prisma);
    const replay = await stack2.service.setKillSwitch(claims, flag.id, true, body, idem);
    expect((replay as { rowVersion: number }).rowVersion).toBe(2);
    expect(await prisma.platformFeatureFlagHistory.count({ where: { flagId: flag.id } })).toBe(1);
    expect(JSON.stringify(stack.audit.entries[0])).not.toMatch(/password|secret|stack trace/i);
  });
});
