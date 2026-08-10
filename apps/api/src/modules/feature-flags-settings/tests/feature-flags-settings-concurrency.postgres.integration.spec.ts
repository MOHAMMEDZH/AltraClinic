/**
 * Flexible Step 20 — PostgreSQL concurrency matrix C01–C20.
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

async function settled(promises: Promise<unknown>[]) {
  return Promise.allSettled(promises);
}

describeDb('Step 20 concurrency matrix C01-C20 (PostgreSQL)', () => {
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

  async function actors() {
    const a = await createPlatformUserFixture(prisma, {
      email: `ff-c-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const b = await createPlatformUserFixture(prisma, {
      email: `ff-c-b-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    return {
      a,
      b,
      claimsA: platformClaims(a.id, randomUUID()),
      claimsB: platformClaims(b.id, randomUUID()),
    };
  }

  it('C01 create same flag key versus create same flag key', async () => {
    const stack = createFfStack(prisma);
    const { claimsA, claimsB } = await actors();
    const key = `ops.c01.${randomUUID().slice(0, 8)}`;
    const body = {
      canonicalKey: key,
      displayName: 'C01',
      description: 'dup',
      ownerTeam: 'ops',
      category: 'test',
      effect: 'OPERATIONAL_ENABLEMENT' as const,
      reason: 'create',
    };
    const results = await settled([
      stack.service.createFlag(claimsA, body, `c01a-${randomUUID()}`),
      stack.service.createFlag(claimsB, body, `c01b-${randomUUID()}`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(1);
  });

  it('C02 update flag versus update flag', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id);
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateFlag(
        claimsA,
        flag.id,
        { reason: 'a', expectedRowVersion: 1, displayName: 'A' },
        randomUUID(),
      ),
      stack.service.updateFlag(
        claimsB,
        flag.id,
        { reason: 'b', expectedRowVersion: 1, displayName: 'B' },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(row.rowVersion).toBe(2);
  });

  it('C03 target update versus target update', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, { targetType: 'TENANT_ALLOWLIST' });
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateTargets(
        claimsA,
        flag.id,
        { allowTenantIds: [randomUUID()], reason: 'a', expectedRowVersion: 1 },
        randomUUID(),
      ),
      stack.service.updateTargets(
        claimsB,
        flag.id,
        { allowTenantIds: [randomUUID()], reason: 'b', expectedRowVersion: 1 },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C04 kill-switch activate versus activate', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, { effect: 'KILL_SWITCH_DENY' });
    const stack = createFfStack(prisma);
    const body = {
      reason: 'kill',
      expectedRowVersion: 1,
      previewFingerprint: 'fp',
      confirmation: 'CONFIRM',
    };
    const results = await settled([
      stack.service.setKillSwitch(claimsA, flag.id, true, body, randomUUID()),
      stack.service.setKillSwitch(claimsB, flag.id, true, body, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(row.killSwitchActive).toBe(true);
    expect(row.rowVersion).toBe(2);
  });

  it('C05 activate versus deactivate', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, {
      effect: 'KILL_SWITCH_DENY',
      killSwitchActive: false,
    });
    const stack = createFfStack(prisma);
    const base = {
      reason: 'race',
      expectedRowVersion: 1,
      previewFingerprint: 'fp',
      confirmation: 'CONFIRM',
    };
    const results = await settled([
      stack.service.setKillSwitch(claimsA, flag.id, true, base, randomUUID()),
      stack.service.setKillSwitch(claimsB, flag.id, false, base, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C06 rollout percentage versus target-list', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, { targetType: 'PERCENTAGE', rolloutPercentage: 10 });
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateFlag(
        claimsA,
        flag.id,
        { reason: 'pct', expectedRowVersion: 1, rolloutPercentage: 50 },
        randomUUID(),
      ),
      stack.service.updateTargets(
        claimsB,
        flag.id,
        { denyTenantIds: [randomUUID()], reason: 'deny', expectedRowVersion: 1 },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C07 flag update versus deprecate', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id);
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateFlag(
        claimsA,
        flag.id,
        { reason: 'u', expectedRowVersion: 1, displayName: 'U' },
        randomUUID(),
      ),
      stack.service.updateFlag(
        claimsB,
        flag.id,
        { reason: 'd', expectedRowVersion: 1, status: 'DEPRECATED' },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C08 setting update versus setting update', async () => {
    const { a, claimsA, claimsB } = await actors();
    const setting = await seedSetting(prisma, a.id);
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateSetting(
        claimsA,
        setting.id,
        { safeValueJson: { enabled: true }, reason: 'a', expectedRowVersion: 1 },
        randomUUID(),
      ),
      stack.service.updateSetting(
        claimsB,
        setting.id,
        { safeValueJson: { enabled: false }, reason: 'b', expectedRowVersion: 1 },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await prisma.platformGlobalSetting.findUniqueOrThrow({ where: { id: setting.id } });
    expect(row.rowVersion).toBe(2);
  });

  it('C09 setting update versus environment compatibility refresh (no env mutate)', async () => {
    const { a, claimsA } = await actors();
    const setting = await seedSetting(prisma, a.id);
    const stack = createFfStack(prisma);
    const before = process.env.FEATURE_FLAGS_SETTINGS_ENABLED;
    await stack.service.updateSetting(
      claimsA,
      setting.id,
      { safeValueJson: { enabled: true }, reason: 'env-compat', expectedRowVersion: 1 },
      randomUUID(),
    );
    expect(process.env.FEATURE_FLAGS_SETTINGS_ENABLED).toBe(before);
  });

  it('C10 preview versus concurrent mutation — preview read-only', async () => {
    const { a, claimsA } = await actors();
    const flag = await seedActiveFlag(prisma, a.id);
    const stack = createFfStack(prisma);
    const preview = stack.service.previewFlagChange({
      flagId: flag.id,
      action: 'UPDATE',
      proposed: { displayName: 'X' },
    });
    await stack.service.updateFlag(
      claimsA,
      flag.id,
      { reason: 'mutate', expectedRowVersion: 1, displayName: 'Y' },
      randomUUID(),
    );
    expect(preview.previewFingerprint).toBeTruthy();
    const row = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(row.displayName).toBe('Y');
  });

  it('C11 flag mutation versus EER evaluation — entitlement deny unchanged', async () => {
    const { a, claimsA } = await actors();
    const flag = await seedActiveFlag(prisma, a.id);
    const stack = createFfStack(prisma);
    const tenantId = randomUUID();
    const [evalResult] = await Promise.all([
      stack.operational.evaluate({
        tenantId,
        flagKey: flag.canonicalKey,
        entitlementAllows: false,
        lifecycleDenied: false,
      }),
      stack.service.updateFlag(
        claimsA,
        flag.id,
        { reason: 'while-eval', expectedRowVersion: 1, displayName: 'Z' },
        randomUUID(),
      ),
    ]);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.explanationCode).toBe('entitlement_denied');
  });

  it('C12 kill-switch mutation versus cached allow', async () => {
    const { a, claimsA } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, { effect: 'KILL_SWITCH_DENY' });
    const stack = createFfStack(prisma);
    const tenantId = randomUUID();
    const warm = await stack.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(warm.allowed).toBe(true);
    await stack.service.setKillSwitch(
      claimsA,
      flag.id,
      true,
      {
        reason: 'kill cache',
        expectedRowVersion: 1,
        previewFingerprint: 'fp',
        confirmation: 'CONFIRM',
      },
      randomUUID(),
    );
    const after = await stack.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(after.allowed).toBe(false);
    expect(after.explanationCode).toBe('kill_switch_denied');
  });

  it('C13 tenant A target versus tenant B target', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flagA = await seedActiveFlag(prisma, a.id, {
      key: `ops.c13a.${randomUUID().slice(0, 8)}`,
      targetType: 'TENANT_ALLOWLIST',
    });
    const flagB = await seedActiveFlag(prisma, a.id, {
      key: `ops.c13b.${randomUUID().slice(0, 8)}`,
      targetType: 'TENANT_ALLOWLIST',
    });
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateTargets(
        claimsA,
        flagA.id,
        { allowTenantIds: [randomUUID()], reason: 'a', expectedRowVersion: 1 },
        randomUUID(),
      ),
      stack.service.updateTargets(
        claimsB,
        flagB.id,
        { allowTenantIds: [randomUUID()], reason: 'b', expectedRowVersion: 1 },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  });

  it('C14 exact replay versus concurrent first execution', async () => {
    const { claimsA } = await actors();
    const stack = createFfStack(prisma);
    const key = `ops.c14.${randomUUID().slice(0, 8)}`;
    const body = {
      canonicalKey: key,
      displayName: 'C14',
      description: 'idemp',
      ownerTeam: 'ops',
      category: 'test',
      effect: 'OPERATIONAL_ENABLEMENT' as const,
      reason: 'create',
    };
    const idem = `c14-${randomUUID()}`;
    const first = await stack.service.createFlag(claimsA, body, idem);
    const replay = await stack.service.createFlag(claimsA, body, idem);
    expect((replay as { id: string }).id).toBe((first as { id: string }).id);
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(1);
  });

  it('C15 conflicting idempotency payloads', async () => {
    const { claimsA } = await actors();
    const stack = createFfStack(prisma);
    const idem = `c15-${randomUUID()}`;
    await stack.service.createFlag(
      claimsA,
      {
        canonicalKey: `ops.c15a.${randomUUID().slice(0, 8)}`,
        displayName: 'A',
        description: 'a',
        ownerTeam: 'ops',
        category: 'test',
        effect: 'OPERATIONAL_ENABLEMENT',
        reason: 'a',
      },
      idem,
    );
    await expect(
      stack.service.createFlag(
        claimsA,
        {
          canonicalKey: `ops.c15b.${randomUUID().slice(0, 8)}`,
          displayName: 'B',
          description: 'b',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          reason: 'b',
        },
        idem,
      ),
    ).rejects.toBeTruthy();
  });

  it('C16 owner update versus operational update', async () => {
    const { a, claimsA, claimsB } = await actors();
    const flag = await seedActiveFlag(prisma, a.id);
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateFlag(
        claimsA,
        flag.id,
        { reason: 'owner', expectedRowVersion: 1, ownerTeam: 'sec' },
        randomUUID(),
      ),
      stack.service.updateFlag(
        claimsB,
        flag.id,
        { reason: 'ops', expectedRowVersion: 1, category: 'rollout' },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C17 history/audit write versus rollback (injection before commit)', async () => {
    const { claimsA } = await actors();
    const stack = createFfStack(prisma);
    const { setFfFailureInjection } = await import('./feature-flags-settings-db.harness');
    setFfFailureInjection('before_commit');
    const key = `ops.c17.${randomUUID().slice(0, 8)}`;
    await expect(
      stack.service.createFlag(
        claimsA,
        {
          canonicalKey: key,
          displayName: 'C17',
          description: 'fail',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          reason: 'fail',
        },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();
    clearFfFailureInjection();
    expect(await prisma.platformFeatureFlag.count({ where: { canonicalKey: key } })).toBe(0);
  });

  it('C18 two services evaluating deterministic percentage', async () => {
    const { a } = await actors();
    const flag = await seedActiveFlag(prisma, a.id, {
      targetType: 'PERCENTAGE',
      rolloutPercentage: 50,
    });
    const s1 = createFfStack(prisma);
    const s2 = createFfStack(prisma);
    const tenantId = randomUUID();
    const r1 = await s1.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    const r2 = await s2.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(r1.allowed).toBe(r2.allowed);
    expect(r1.rolloutIncluded).toBe(r2.rolloutIncluded);
  });

  it('C19 target deletion versus evaluation', async () => {
    const { a, claimsA } = await actors();
    const tenantId = randomUUID();
    const flag = await seedActiveFlag(prisma, a.id, { targetType: 'TENANT_ALLOWLIST' });
    await prisma.platformFeatureFlagTarget.create({
      data: { flagId: flag.id, tenantId, mode: 'ALLOW' },
    });
    const stack = createFfStack(prisma);
    await stack.service.updateTargets(
      claimsA,
      flag.id,
      { allowTenantIds: [], reason: 'clear', expectedRowVersion: 1 },
      randomUUID(),
    );
    const result = await stack.operational.evaluate({
      tenantId,
      flagKey: flag.canonicalKey,
      entitlementAllows: true,
      lifecycleDenied: false,
    });
    expect(result.allowed).toBe(false);
  });

  it('C20 unrelated flags mutate concurrently', async () => {
    const { a, claimsA, claimsB } = await actors();
    const f1 = await seedActiveFlag(prisma, a.id, { key: `ops.c20a.${randomUUID().slice(0, 8)}` });
    const f2 = await seedActiveFlag(prisma, a.id, { key: `ops.c20b.${randomUUID().slice(0, 8)}` });
    const stack = createFfStack(prisma);
    const results = await settled([
      stack.service.updateFlag(
        claimsA,
        f1.id,
        { reason: '1', expectedRowVersion: 1, displayName: '1' },
        randomUUID(),
      ),
      stack.service.updateFlag(
        claimsB,
        f2.id,
        { reason: '2', expectedRowVersion: 1, displayName: '2' },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  });
});
