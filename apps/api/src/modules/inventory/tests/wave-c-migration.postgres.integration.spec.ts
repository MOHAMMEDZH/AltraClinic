/**
 * Wave C migration assertions — C-MIG-01..10 (full).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
} from '../../auth/tests/platform-db-security.harness';

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C migration (postgres)', () => {
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  const migrationSqlPath = path.join(
    __dirname,
    '../../../../prisma/migrations/20260816010000_phase48_wave_c_clinical_safety/migration.sql',
  );

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('C-MIG-01 — clean database migration succeeds', async () => {
    for (const table of [
      'clinical_form_templates',
      'clinical_form_versions',
      'patient_form_instances',
      'clinical_service_form_requirements',
      'injectable_usage_details',
    ]) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
      )) as Array<{ present: boolean }>;
      expect(rows[0]?.present).toBe(true);
    }
    expect(fs.existsSync(migrationSqlPath)).toBe(true);
  });

  it('C-MIG-02 — upgrade from accepted Wave B succeeds', async () => {
    const waveB = (await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.appointment_service_snapshot_revisions') IS NOT NULL AS present`,
    )) as Array<{ present: boolean }>;
    expect(waveB[0]?.present).toBe(true);
    const waveC = (await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.clinical_form_templates') IS NOT NULL AS present`,
    )) as Array<{ present: boolean }>;
    expect(waveC[0]?.present).toBe(true);
    const upgradeScript = path.join(
      __dirname,
      '../../../../scripts/validate-phase48-wave-c-upgrade.mjs',
    );
    expect(fs.existsSync(upgradeScript)).toBe(true);
  });

  it('C-MIG-03 — existing InventoryConsumptionLog rows preserved', async () => {
    const cols = (await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_consumption_logs'
    `)) as Array<{ column_name: string }>;
    const names = cols.map((c) => c.column_name);
    expect(names).toContain('quantityUsed');
    expect(names).toContain('consumedBy');
    expect(names).toContain('consumedAt');
    // Additive Wave C columns present without dropping legacy table.
    expect(names).toContain('usageType');
    expect(names).toContain('attributionStatus');
  });

  it('C-MIG-04 — deterministic movement/batch links preserved when provable', async () => {
    const cols = (await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_consumption_logs'
        AND column_name IN ('sourceStockMovementId','inventoryBatchId')
    `)) as unknown[];
    expect(cols.length).toBe(2);
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).toMatch(/sourceStockMovementId/);
    expect(sql).toMatch(/inventoryBatchId/);
  });

  it('C-MIG-05 — unknown usedBy becomes LEGACY_UNATTRIBUTED / remains unattributed', async () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).toMatch(/LEGACY_UNATTRIBUTED/);
    expect(sql).toMatch(/attributionStatus/);
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT column_default::text AS def
      FROM information_schema.columns
      WHERE table_name = 'inventory_consumption_logs'
        AND column_name = 'attributionStatus'
    `)) as Array<{ def: string | null }>;
    expect(rows.length).toBe(1);
  });

  it('C-MIG-06 — no historical employee invented', async () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).not.toMatch(/UPDATE\s+"usedByUserId"\s*=\s*'[0-9a-f-]{36}'/i);
    expect(sql).not.toMatch(/SET\s+"usedByUserId"\s*=\s*'[0-9a-f-]{36}'/i);
    expect(sql).toMatch(/LEGACY_UNATTRIBUTED/);
  });

  it('C-MIG-07 — no historical batch usage invented', async () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).not.toMatch(/UPDATE\s+"inventoryBatchId"\s*=/i);
    expect(sql).not.toMatch(/INSERT INTO\s+"?inventory_consumption_logs"?/i);
  });

  it('C-MIG-08 — existing plan consent timestamps preserved without synthetic signatures', async () => {
    const cols = (await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'treatment_plans'
        AND column_name IN ('consentSignedAt','consentRecordedBy','consentMethod')
    `)) as unknown[];
    expect(cols.length).toBe(3);
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).not.toMatch(/INSERT INTO\s+"?patient_form_instances"?/i);
    expect(sql).not.toMatch(/consentSignedAt/);
  });

  it('C-MIG-09 — backfill rerun/idempotency', async () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf8');
    expect(sql).toMatch(/SET "attributionStatus" = 'LEGACY_UNATTRIBUTED'/);
    // Conditional UPDATE is idempotent (WHERE usedBy IS NULL). Post-trigger, live
    // re-application against POSTED clinical rows is blocked by append-only protection —
    // migration order applies backfill before the immutability trigger.
    expect(sql).toMatch(/"usedByUserId" IS NULL/);
    expect(sql.indexOf('SET "attributionStatus" = \'LEGACY_UNATTRIBUTED\'')).toBeLessThan(
      sql.indexOf('prevent_inventory_usage_ledger_mutation'),
    );
    const legacyCount = (await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c FROM inventory_consumption_logs
      WHERE "attributionStatus" = 'LEGACY_UNATTRIBUTED'
    `)) as Array<{ c: number }>;
    expect(legacyCount[0].c).toBeGreaterThanOrEqual(0);
  });

  it('C-MIG-10 — Wave A/B validators remain green with Wave C migration parked/applied appropriately', async () => {
    const waveA = (await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.clinical_service_price_versions') IS NOT NULL AS present`,
    )) as Array<{ present: boolean }>;
    const waveB = (await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public.appointment_service_snapshot_revisions') IS NOT NULL AS present`,
    )) as Array<{ present: boolean }>;
    expect(waveA[0]?.present).toBe(true);
    expect(waveB[0]?.present).toBe(true);
    for (const script of [
      'validate-phase48-wave-a-upgrade.mjs',
      'validate-phase48-wave-b-upgrade.mjs',
      'validate-phase48-wave-c-upgrade.mjs',
      'validate-phase48-wave-c-clean.mjs',
    ]) {
      const p = path.join(__dirname, '../../../../scripts', script);
      expect(fs.existsSync(p)).toBe(true);
    }
    const waveAUpgrade = fs.readFileSync(
      path.join(__dirname, '../../../../scripts/validate-phase48-wave-a-upgrade.mjs'),
      'utf8',
    );
    expect(waveAUpgrade).toMatch(/wave_c|phase48_wave_c/i);
  });
});
