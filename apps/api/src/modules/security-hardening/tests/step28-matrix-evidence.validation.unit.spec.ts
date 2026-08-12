import * as fs from 'fs';
import * as path from 'path';
import {
  assertMatrixEvidenceComplete,
  MATRIX_EVIDENCE,
  STEP28_CANONICAL_FAMILY_COUNTS,
  STEP28_CLOSURE_FAMILY_COUNTS,
  STEP28_MATRIX_EVIDENCE_IDS,
  matrixFamilyOf,
} from '../step28-matrix-evidence';

/** Jest cwd is apps/api; repository root is two levels up. */
const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

/**
 * Deterministic linkage alternative (documented):
 * - exact-title / id-tag / suite-anchor: testTitle must appear in testFile (it/test/describe)
 * - script-file: referenced .mjs/.js script must exist (no Jest titles)
 */
function linkageOk(e: (typeof MATRIX_EVIDENCE)[number]): string | null {
  const abs = path.join(REPO_ROOT, e.testFile.replace(/\\/g, '/'));
  if (!fs.existsSync(abs)) return `${e.id}: missing file ${e.testFile}`;
  const text = fs.readFileSync(abs, 'utf8');
  if (e.linkageMode === 'script-file' || /\.(mjs|js|cjs)$/.test(e.testFile)) {
    return null;
  }
  const titleCore = e.testTitle.replace(/\s*\[[A-Z0-9]+\]\s*$/, '').trim();
  const hasTitle =
    text.includes(e.testTitle) ||
    (titleCore.length > 0 && text.includes(titleCore));
  const hasId = text.includes(e.id) || text.includes(`${e.id}:`);
  if (!hasTitle && !hasId) return `${e.id}: title/ID not in ${e.testFile}`;
  return null;
}

describe('Step 28 matrix evidence validation', () => {
  it('assertMatrixEvidenceComplete passes for full ID universe', () => {
    expect(() => assertMatrixEvidenceComplete()).not.toThrow();
  });

  it('has no duplicate IDs and matches expected universe size', () => {
    const ids = MATRIX_EVIDENCE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(STEP28_MATRIX_EVIDENCE_IDS.length);
  });

  it('matches exact family counts for canonical and closure families', () => {
    const all = { ...STEP28_CANONICAL_FAMILY_COUNTS, ...STEP28_CLOSURE_FAMILY_COUNTS };
    for (const [fam, expected] of Object.entries(all)) {
      const actual = MATRIX_EVIDENCE.filter((e) => matrixFamilyOf(e.id) === fam).length;
      expect({ fam, actual }).toEqual({ fam, actual: expected });
    }
    const canonicalTotal = Object.values(STEP28_CANONICAL_FAMILY_COUNTS).reduce((a, b) => a + b, 0);
    const closureTotal = Object.values(STEP28_CLOSURE_FAMILY_COUNTS).reduce((a, b) => a + b, 0);
    expect(canonicalTotal).toBe(660);
    expect(closureTotal).toBe(44);
    expect(canonicalTotal + closureTotal).toBe(704);
  });

  it('every ID has non-empty canonicalMeaning and executable fields or rigorous N/A', () => {
    for (const e of MATRIX_EVIDENCE) {
      expect(e.canonicalMeaning.trim().length).toBeGreaterThan(0);
      expect(e.result).toBeTruthy();
      if (e.applicability === 'na' || e.result === 'N/A') {
        expect((e.naReason ?? '').trim().length).toBeGreaterThan(0);
        expect((e.repositoryEvidence ?? '').trim().length).toBeGreaterThan(0);
        expect((e.whyNoEquivalentSurfaceExists ?? '').trim().length).toBeGreaterThan(0);
        expect(e.naReason).not.toMatch(/not separately tested|same helper|missing hook|all pass/i);
      } else {
        expect(e.testFile.trim().length).toBeGreaterThan(0);
        expect(e.testTitle.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('referenced executable evidence files exist with deterministic title/script linkage', () => {
    const missing: string[] = [];
    for (const e of MATRIX_EVIDENCE) {
      if (e.applicability === 'na' || e.result === 'N/A') {
        const evidencePath = (e.repositoryEvidence || e.testFile || '')
          .split(/[;\s]+/)
          .map((s) => s.replace(/[),]+$/g, ''))
          .find((s) => s.includes('/') && /\.(ts|tsx|js|mjs|cjs|md)$/.test(s));
        if (evidencePath) {
          const abs = path.join(REPO_ROOT, evidencePath.replace(/\\/g, '/'));
          if (!fs.existsSync(abs)) missing.push(`${e.id}: N/A repositoryEvidence missing ${evidencePath}`);
        }
        continue;
      }
      const err = linkageOk(e);
      if (err) missing.push(err);
    }
    expect(missing).toEqual([]);
  });

  it('includes RLTEST, TENSA, and CSP closure families', () => {
    expect(STEP28_MATRIX_EVIDENCE_IDS).toEqual(
      expect.arrayContaining(['RLTEST01', 'RLTEST08', 'TENSA01', 'TENSA20', 'CSP01', 'CSP16']),
    );
  });

  it('N/A set is exactly CSRF07 and HDR15', () => {
    const na = MATRIX_EVIDENCE.filter((e) => e.result === 'N/A').map((e) => e.id).sort();
    expect(na).toEqual(['CSRF07', 'HDR15']);
  });

  it('no placeholder or all-pass assertions', () => {
    for (const e of MATRIX_EVIDENCE) {
      expect(e.canonicalMeaning).not.toMatch(/TODO|TBD|placeholder|see MATRIX_EVIDENCE/i);
      expect(e.expectedResult).not.toMatch(/^all pass$/i);
    }
  });
});
