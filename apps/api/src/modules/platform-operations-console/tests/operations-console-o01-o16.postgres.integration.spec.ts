/**
 * Flexible Step 22 — O01–O16 adapter/SoR focused suite.
 */
import { PrismaClient } from '@prisma/client';
import {
  cleanupOpsConsoleTables,
  createOpsStack,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  enableOpsConsole,
  platformDbSecurityEnabled,
} from './operations-console-db.harness';
import {
  assertSafePlatformTestDatabaseUrl,
} from '../../auth/tests/platform-db-security.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 22 Operations Console O01–O16 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let restore: () => void;
  let stack: ReturnType<typeof createOpsStack>;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    restore = enableOpsConsole();
    raw = createPlatformDbSecurityClient();
    stack = createOpsStack(raw);
  });

  afterAll(async () => {
    restore();
    await raw?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupOpsConsoleTables(raw);
  });

  it('O01–O04 health never marks absent probes as HEALTHY', async () => {
    const health = await stack.query.health();
    expect(health.probes.length).toBeGreaterThanOrEqual(4);
    for (const p of health.probes) {
      if (p.sourceTimestamp == null && p.sourceStatus == null) {
        expect(p.normalizedStatus).not.toBe('HEALTHY');
      }
    }
    const o02 = health.probes.find((p) => p.id === 'O02');
    expect(o02?.normalizedStatus === 'HEALTHY' || o02?.normalizedStatus === 'UNHEALTHY').toBe(
      true,
    );
  });

  it('O06/O07 subscription and override expiry job SoR is DISABLED', async () => {
    const subs = await stack.query.listSubscriptionExpiry({ limit: 5 });
    const ovrs = await stack.query.listOverrideExpiry({ limit: 5 });
    for (const row of [...subs, ...ovrs]) {
      expect(row.jobSorStatus).toBe('DISABLED');
      expect(row.normalizedStatus).toBe('DISABLED');
    }
  });

  it('O08 entitlement health reports process-local cache topology', async () => {
    const health = await stack.query.entitlementHealth();
    expect(health.cacheTopology).toBe('process_local');
    expect(health.globalInvalidationHealth).toBe('UNKNOWN');
    expect(health.globalInvalidationHealth).not.toBe('HEALTHY');
  });

  it('O09 compatibility reports Catalog identity and DISABLED validator job', async () => {
    const compat = await stack.query.compatibility();
    expect(compat.validatorJobStatus).toBe('DISABLED');
    expect(compat.catalogItems).toBeGreaterThanOrEqual(0);
    if (compat.catalogItems > 0) {
      expect(compat.catalogIdentityOk).toBe(
        compat.catalogItems === 68 &&
          compat.catalogTranslations === 136 &&
          compat.catalogAliases === 68 &&
          compat.catalogCompatibilityRules === 13,
      );
    }
  });

  it('O10 integrations rows classified I-A|I-B|I-C without secrets', async () => {
    const rows = await stack.query.listIntegrations();
    expect(rows.length).toBeGreaterThan(0);
    const blob = JSON.stringify(rows);
    expect(blob).not.toMatch(/secret|password|Bearer |sk_live|api_key/i);
    for (const row of rows) {
      expect(['I-A', 'I-B', 'I-C']).toContain(row.classification);
    }
  });

  it('O12 backups empty/unwired list is not HEALTHY synthesis', async () => {
    const backups = await stack.query.listBackups({ limit: 10 });
    expect(Array.isArray(backups)).toBe(true);
    for (const row of backups) {
      expect(row.storagePathExposed).toBe(false);
      expect(['B-A', 'B-B', 'B-C']).toContain(row.classification);
    }
    const scheduler = backups.find((b) => b.ref === 'backup_scheduler');
    if (scheduler) {
      expect(scheduler.normalizedStatus).toBe('DISABLED');
    }
  });

  it('overview aggregates without forbidden leaks', async () => {
    const overview = await stack.query.overview();
    expect(overview.cards.length).toBeGreaterThan(0);
    const text = JSON.stringify(overview);
    expect(text).not.toMatch(/postgresql:\/\/|Bearer |sk_live/i);
  });

  it('O08 invalidate marks local snapshot evidence', async () => {
    const before = await stack.query.entitlementHealth();
    stack.query.markCacheInvalidated();
    const after = await stack.query.entitlementHealth();
    expect(after.thisInstanceLastInvalidationAt).not.toBe(before.thisInstanceLastInvalidationAt);
  });
});
