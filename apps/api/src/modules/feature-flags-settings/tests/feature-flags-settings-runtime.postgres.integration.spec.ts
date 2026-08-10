/**
 * Flexible Step 20 — runtime precedence + secrets (PostgreSQL).
 */
import { randomUUID } from 'crypto';
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
} from './feature-flags-settings-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 20 runtime precedence (PostgreSQL)', () => {
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

  it('entitlement deny + flag allow => deny', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-eer-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const flag = await seedActiveFlag(prisma, user.id, { key: `ops.eer.${randomUUID().slice(0, 8)}` });
    const stack = createFfStack(prisma);
    const result = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: false,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.explanationCode).toBe('entitlement_denied');
  });

  it('entitlement allow + kill switch => deny', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-ks-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const flag = await seedActiveFlag(prisma, user.id, {
      key: `ops.ks.${randomUUID().slice(0, 8)}`,
      killSwitchActive: true,
      effect: 'KILL_SWITCH_DENY',
    });
    const stack = createFfStack(prisma);
    const result = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.explanationCode).toBe('kill_switch_denied');
  });

  it('entitlement allow + rollout exclude => deny exposure', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-ro-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const tenantId = randomUUID();
    const flag = await seedActiveFlag(prisma, user.id, {
      key: `ops.ro.${randomUUID().slice(0, 8)}`,
      targetType: 'TENANT_ALLOWLIST',
    });
    const stack = createFfStack(prisma);
    const result = await stack.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.explanationCode).toBe('rollout_excluded');
  });

  it('entitlement allow + rollout include => allow', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-ok-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const flag = await seedActiveFlag(prisma, user.id, {
      key: `ops.ok.${randomUUID().slice(0, 8)}`,
      targetType: 'GLOBAL',
    });
    const stack = createFfStack(prisma);
    const result = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.explanationCode).toBe('operational_allow');
  });

  it('lifecycle deny wins over flags', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-lc-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const flag = await seedActiveFlag(prisma, user.id);
    const stack = createFfStack(prisma);
    const result = await stack.operational.evaluate({
      tenantId: randomUUID(),
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.explanationCode).toBe('lifecycle_denied');
  });

  it('rejects secret material in setting update', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-sec-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const setting = await seedSetting(prisma, user.id);
    const stack = createFfStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    await expect(
      stack.service.updateSetting(
        claims,
        setting.id,
        {
          safeValueJson: { api_key: 'sk_live_supersecrettokenvalue1234567890' },
          reason: 'attempt secret',
          expectedRowVersion: 1,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'secret_write_forbidden' });
  });

  it('kill switch requires fresh step-up and CONFIRM', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-su-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id, { effect: 'KILL_SWITCH_DENY' });
    const stack = createFfStack(prisma, { stepUpFresh: false });
    const claims = platformClaims(user.id, randomUUID());
    await expect(
      stack.service.setKillSwitch(
        claims,
        flag.id,
        true,
        {
          reason: 'emergency',
          expectedRowVersion: 1,
          previewFingerprint: 'abc',
          confirmation: 'CONFIRM',
        },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();

    stack.setStepUpFresh(true);
    await expect(
      stack.service.setKillSwitch(
        claims,
        flag.id,
        true,
        {
          reason: 'emergency',
          expectedRowVersion: 1,
          previewFingerprint: 'abc',
          confirmation: 'nope',
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'confirmation_required' });
  });

  it('cross-tenant allowlist isolation', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-xt-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const flag = await seedActiveFlag(prisma, user.id, {
      targetType: 'TENANT_ALLOWLIST',
    });
    await prisma.platformFeatureFlagTarget.create({
      data: { flagId: flag.id, tenantId: tenantA, mode: 'ALLOW' },
    });
    const stack = createFfStack(prisma);
    const a = await stack.operational.evaluate({
      tenantId: tenantA,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    const b = await stack.operational.evaluate({
      tenantId: tenantB,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(false);
  });
});
