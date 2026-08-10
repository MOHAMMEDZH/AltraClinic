/**
 * Flexible Step 20 — failure-injection production containment matrix P01–P12.
 * Model B: hooks activate only when NODE_ENV === 'test' AND exact test selector matches.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV,
  FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_POINTS,
  isFeatureFlagsSettingsFailureInjectionActive,
} from '../feature-flags-settings.constants';
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

const HOOK_IDS = [...FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_POINTS];

function withNodeEnvSync<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.NODE_ENV;
  try {
    if (value === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = value;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

async function withNodeEnv<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.NODE_ENV;
  try {
    if (value === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = value;
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

describeDb('Step 20 failure-injection production containment P01-P12 (PostgreSQL)', () => {
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
    // Jest defaults NODE_ENV=test; restore if a prior test leaked.
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    clearFfFailureInjection();
    process.env.NODE_ENV = 'test';
  });

  it('P01 production ignores EER adapter injection — no false deny/allow', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p01-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id);
    const stack = createFfStack(prisma);
    setFfFailureInjection('eer_adapter_failure');

    const result = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: randomUUID(),
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.explanationCode).toBe('operational_allow');

    const denied = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: randomUUID(),
        flagKey: flag.canonicalKey,
        entitlementAllows: false,
        lifecycleDenied: false,
      }),
    );
    expect(denied.allowed).toBe(false);
    expect(denied.explanationCode).toBe('entitlement_denied');
    expect(JSON.stringify(result)).not.toMatch(/password|secret|PHI|stack/i);
  });

  it('P02 production ignores target resolution injection — targeting remains normal', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p02-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const flag = await seedActiveFlag(prisma, user.id, { targetType: 'TENANT_ALLOWLIST' });
    await prisma.platformFeatureFlagTarget.create({
      data: { flagId: flag.id, tenantId: tenantA, mode: 'ALLOW' },
    });
    const stack = createFfStack(prisma);
    setFfFailureInjection('target_resolution_failure');

    const a = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: tenantA,
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    );
    expect(a.allowed).toBe(true);
    const b = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: tenantB,
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    );
    expect(b.allowed).toBe(false);
    expect(b.explanationCode).toBe('rollout_excluded');
    const life = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: tenantA,
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: true,
      }),
    );
    expect(life.explanationCode).toBe('lifecycle_denied');
  });

  it('P03 production ignores notification/outbox injection — durable create succeeds', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p03-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    setFfFailureInjection('notification_outbox_failure');
    const key = `ops.p03.${randomUUID().slice(0, 8)}`;
    const created = await withNodeEnv('production', () =>
      stack.service.createFlag(
        claims,
        {
          canonicalKey: key,
          displayName: 'P03',
          description: 'prod',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          reason: 'p03',
        },
        randomUUID(),
      ),
    );
    expect((created as { canonicalKey: string }).canonicalKey).toBe(key);
    expect(await prisma.platformFeatureFlagHistory.count()).toBe(1);
    expect(await prisma.platformFeatureFlagIdempotencyRecord.count()).toBe(1);
  });

  it('P04 production ignores environment compatibility injection', async () => {
    const stack = createFfStack(prisma);
    setFfFailureInjection('environment_compatibility_adapter_failure');
    const status = withNodeEnvSync('production', () =>
      stack.service.readEnvironmentCompatibilityStatus('setting.feature_flags_settings_enabled_ref'),
    );
    expect(status.envAuthority).toBe(true);
    expect(status.secretMaterialExposed).toBe(false);
    expect(status).not.toHaveProperty('rawValue');
  });

  it('P05 production ignores rollback/recovery injection — kill-switch commits normally', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p05-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id, { effect: 'KILL_SWITCH_DENY' });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    setFfFailureInjection('rollback_recovery_failure');
    const row = await withNodeEnv('production', () =>
      stack.service.setKillSwitch(
        claims,
        flag.id,
        true,
        {
          reason: 'p05',
          expectedRowVersion: 1,
          previewFingerprint: 'fp',
          confirmation: 'CONFIRM',
        },
        randomUUID(),
      ),
    );
    expect((row as { killSwitchActive: boolean }).killSwitchActive).toBe(true);
    expect((row as { rowVersion: number }).rowVersion).toBe(2);
    expect(await prisma.platformFeatureFlagHistory.count({ where: { flagId: flag.id } })).toBe(1);
    expect(stack.audit.entries).toHaveLength(1);
  });

  it('P06 missing NODE_ENV fails safely — injector cannot activate', async () => {
    setFfFailureInjection('eer_adapter_failure');
    expect(
      withNodeEnvSync(undefined, () => isFeatureFlagsSettingsFailureInjectionActive('eer_adapter_failure')),
    ).toBe(false);
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p06-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, user.id);
    const stack = createFfStack(prisma);
    const result = await withNodeEnv(undefined, () =>
      stack.operational.evaluate({
        tenantId: randomUUID(),
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    );
    expect(result.allowed).toBe(true);
  });

  it('P07 development runtime cannot accidentally activate hooks from env', async () => {
    setFfFailureInjection('target_resolution_failure');
    expect(
      withNodeEnvSync('development', () =>
        isFeatureFlagsSettingsFailureInjectionActive('target_resolution_failure'),
      ),
    ).toBe(false);
    for (const point of HOOK_IDS) {
      expect(
        withNodeEnvSync('development', () => isFeatureFlagsSettingsFailureInjectionActive(point)),
      ).toBe(false);
    }
  });

  it('P08 request inputs cannot activate hooks (reason/confirmation/idempotency/body text)', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p08-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    // Intentionally do NOT set FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION.
    clearFfFailureInjection();
    const hookPayload = HOOK_IDS.join('|');
    const key = `ops.p08.${randomUUID().slice(0, 8)}`;
    const created = await stack.service.createFlag(
      claims,
      {
        canonicalKey: key,
        displayName: hookPayload.slice(0, 80),
        description: hookPayload,
        ownerTeam: 'ops',
        category: 'test',
        effect: 'OPERATIONAL_ENABLEMENT',
        reason: `legitimate reason mentioning ${hookPayload}`,
      },
      `idem-eer_adapter_failure-${randomUUID()}`,
    );
    expect((created as { id: string }).id).toBeTruthy();
    expect(stack.audit.entries.some((e) => String(e.action) === 'injected_failure')).toBe(false);

    const flag = await seedActiveFlag(prisma, user.id, { effect: 'KILL_SWITCH_DENY' });
    await stack.service.setKillSwitch(
      claims,
      flag.id,
      true,
      {
        reason: `CONFIRM eer_adapter_failure ${hookPayload}`,
        expectedRowVersion: 1,
        previewFingerprint: `fp-rollback_recovery_failure`,
        confirmation: 'CONFIRM',
      },
      randomUUID(),
    );
    const row = await prisma.platformFeatureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(row.killSwitchActive).toBe(true);
    expect(row.rowVersion).toBe(2);
  });

  it('P09 database values cannot activate hooks — inert data only', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p09-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    clearFfFailureInjection();
    const setting = await seedSetting(prisma, user.id, {
      key: `setting.p09.${randomUUID().slice(0, 6)}`,
    });
    await stack.service.updateSetting(
      claims,
      setting.id,
      {
        safeValueJson: {
          note: 'eer_adapter_failure',
          target: 'rollback_recovery_failure',
        },
        reason: 'notification_outbox_failure as ordinary reason text',
        expectedRowVersion: 1,
      },
      randomUUID(),
    );
    await stack.service.updateSettingReference(
      claims,
      setting.id,
      {
        referenceConfigured: true,
        referenceProviderType: 'smtp',
        referenceId: 'ref-eer_adapter_failure',
        referenceHealthCategory: 'ok',
        reason: 'target_resolution_failure',
        expectedRowVersion: 2,
      },
      randomUUID(),
    );
    // Even with injection env set under production, DB values remain inert.
    setFfFailureInjection('eer_adapter_failure');
    const inertFlag = await seedActiveFlag(prisma, user.id);
    const evalOk = await withNodeEnv('production', () =>
      stack.operational.evaluate({
        tenantId: randomUUID(),
        flagKey: inertFlag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      }),
    );
    expect(evalOk.allowed).toBe(true);
    const row = await prisma.platformGlobalSetting.findUniqueOrThrow({ where: { id: setting.id } });
    expect(JSON.stringify(row)).not.toMatch(/smtp_password|api_key=|Bearer /i);
  });

  it('P10 production configuration surface is clean — no injection variables', () => {
    const apiRoot = path.resolve(__dirname, '../../../..');
    const repoRoot = path.resolve(apiRoot, '../..');
    const files = [
      path.join(apiRoot, '.env.example'),
      path.join(repoRoot, 'docker-compose.test.yml'),
      path.join(apiRoot, 'package.json'),
    ];
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION/);
      for (const hook of [
        'eer_adapter_failure',
        'notification_outbox_failure',
        'environment_compatibility_adapter_failure',
        'target_resolution_failure',
        'rollback_recovery_failure',
      ]) {
        // Allow mentions only inside comments is not expected in these config files.
        expect(text).not.toContain(hook);
      }
    }
    // Guard helper itself requires NODE_ENV=test.
    expect(typeof isFeatureFlagsSettingsFailureInjectionActive).toBe('function');
  });

  it('P11 frontend surface is clean — no hook controls/keys', () => {
    const repoRoot = path.resolve(__dirname, '../../../../..');
    const saRoot = path.join(repoRoot, 'apps/super-admin');
    const clinicRoot = path.join(repoRoot, 'apps/clinic-dashboard');
    const scanRoots = [saRoot, clinicRoot].filter((p) => fs.existsSync(p));
    const banned = [
      'FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION',
      'eer_adapter_failure',
      'notification_outbox_failure',
      'environment_compatibility_adapter_failure',
      'target_resolution_failure',
      'rollback_recovery_failure',
      'isFeatureFlagsSettingsFailureInjectionActive',
    ];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'build') continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx|json|md)$/.test(ent.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        for (const b of banned) {
          if (text.includes(b)) hits.push(`${full}::${b}`);
        }
      }
    };
    for (const root of scanRoots) walk(root);
    expect(hits).toEqual([]);
  });

  it('P12 logs, metrics, audit, and errors are clean of injector controls', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-p12-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const stack = createFfStack(prisma);
    clearFfFailureInjection();
    await stack.service.createFlag(
      claims,
      {
        canonicalKey: `ops.p12.${randomUUID().slice(0, 8)}`,
        displayName: 'P12',
        description: 'clean',
        ownerTeam: 'ops',
        category: 'test',
        effect: 'OPERATIONAL_ENABLEMENT',
        reason: 'normal-create',
      },
      randomUUID(),
    );
    const auditBlob = JSON.stringify(stack.audit.entries);
    expect(auditBlob).not.toContain(FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV);
    expect(auditBlob).not.toContain('eer_adapter_failure');
    expect(auditBlob).not.toMatch(/password|apikey|connectionstring/i);

    // Under production, even with selector set, failures are ordinary (no injected_failure code path).
    setFfFailureInjection('after_authorization');
    await withNodeEnv('production', async () => {
      try {
        await stack.service.createFlag(
          claims,
          {
            canonicalKey: `ops.p12b.${randomUUID().slice(0, 8)}`,
            displayName: 'P12b',
            description: 'clean',
            ownerTeam: 'ops',
            category: 'test',
            effect: 'OPERATIONAL_ENABLEMENT',
            reason: 'prod-create',
          },
          randomUUID(),
        );
      } catch (err) {
        const msg = JSON.stringify(err);
        expect(msg).not.toContain(FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV);
        expect((err as { code?: string }).code).not.toBe('injected_failure');
      }
    });
  });

  it('containment helper: activates only under NODE_ENV=test with exact selector', () => {
    setFfFailureInjection('eer_adapter_failure');
    expect(withNodeEnvSync('test', () => isFeatureFlagsSettingsFailureInjectionActive('eer_adapter_failure'))).toBe(
      true,
    );
    expect(withNodeEnvSync('production', () => isFeatureFlagsSettingsFailureInjectionActive('eer_adapter_failure'))).toBe(
      false,
    );
    expect(withNodeEnvSync('development', () => isFeatureFlagsSettingsFailureInjectionActive('eer_adapter_failure'))).toBe(
      false,
    );
    expect(withNodeEnvSync(undefined, () => isFeatureFlagsSettingsFailureInjectionActive('eer_adapter_failure'))).toBe(
      false,
    );
    expect(withNodeEnvSync('test', () => isFeatureFlagsSettingsFailureInjectionActive('target_resolution_failure'))).toBe(
      false,
    );
  });
});
