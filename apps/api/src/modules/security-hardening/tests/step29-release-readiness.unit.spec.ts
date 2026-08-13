/**
 * Step 29 — static release-readiness document and tooling gates (no product behavior).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

describe('Step 29 release readiness static gates', () => {
  const readinessPath = path.join(REPO_ROOT, 'docs/RELEASE_47_STEP29_RELEASE_READINESS.md');

  it('release readiness contract exists with playbook scenarios and invariants', () => {
    expect(fs.existsSync(readinessPath)).toBe(true);
    const text = fs.readFileSync(readinessPath, 'utf8');
    expect(text).toMatch(/68 \/ 136 \/ 68 \/ 13/);
    expect(text).toMatch(/plan\.lite/);
    expect(text).toMatch(/plan\.pro/);
    expect(text).toMatch(/plan\.enterprise/);
    expect(text).toMatch(/missing != Unlimited/);
    for (const s of [
      'Dental clinic',
      'Cosmetic clinic',
      'General clinic',
      'Multi-specialty',
      'Add-on purchase',
      'Temporary tenant override',
      'Plan version change',
      'Trial expiry',
      'Limit exceeded',
      'Feature flag disabled',
      'Unauthorized API',
      'Cross-tenant cache',
    ]) {
      expect(text).toContain(s);
    }
  });

  it('backup/restore and migration tooling files exist', () => {
    for (const rel of [
      'apps/api/scripts/backup-postgres.ps1',
      'apps/api/scripts/backup-postgres.sh',
      'apps/api/scripts/verify-backup.sh',
      'apps/api/scripts/restore-postgres.sh',
      'apps/api/scripts/apply-rls.mjs',
      'apps/api/scripts/apply-triggers.mjs',
      'apps/api/scripts/run-step29-final-onepass.mjs',
      'docs/PRODUCTION_MIGRATION_WORKFLOW.md',
      'docs/DISASTER_RECOVERY.md',
    ]) {
      expect(fs.existsSync(path.join(REPO_ROOT, rel))).toBe(true);
    }
  });

  it('does not authorize Step 30 or mark Step 29 formally accepted', () => {
    const text = fs.readFileSync(readinessPath, 'utf8');
    expect(text).toMatch(/acceptance pending external review/i);
    expect(text).toMatch(/No Step 30/);
  });
});
