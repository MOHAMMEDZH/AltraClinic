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

  it('semantic review status has no PARTIAL or MISMATCH', () => {
    const bad = MATRIX_EVIDENCE.filter(
      (e) => e.semanticReviewStatus === 'PARTIAL' || e.semanticReviewStatus === 'MISMATCH',
    ).map((e) => e.id);
    expect(bad).toEqual([]);
  });

  it('TH docs-control-map records have executable mitigationIds (no circular docs-only)', () => {
    const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
    const th = MATRIX_EVIDENCE.filter((e) => e.id.startsWith('TH'));
    expect(th).toHaveLength(40);
    for (const e of th) {
      expect(e.semanticEvidenceType).toBe('docs-control-map');
      expect(e.semanticReviewStatus).toBe('DOCS_ONLY');
      expect(e.mitigationIds?.length ?? 0).toBeGreaterThan(0);
      expect(e.testTitle).not.toMatch(/includes every required Step 28 matrix ID/i);
      for (const mid of e.mitigationIds ?? []) {
        const m = byId.get(mid);
        expect(m).toBeTruthy();
        expect(m!.semanticEvidenceType).not.toBe('docs-control-map');
        expect(String(m!.id).startsWith('TH')).toBe(false);
      }
    }
  });

  it('reviewer-flagged IDs have exact semantic proofs', () => {
    const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
    const auth04 = byId.get('AUTH04')!;
    expect(auth04.testTitle).toMatch(/AUTH04|missing authentication|Unauthorized/i);
    expect(auth04.semanticReviewStatus).toBe('EXACT');

    const auth10 = byId.get('AUTH10')!;
    expect(auth10.testTitle).toMatch(/AUTH10|suspended/i);
    expect(auth10.semanticReviewStatus).toBe('EXACT');

    const auth11 = byId.get('AUTH11')!;
    expect(auth11.testTitle).toMatch(/AUTH11|cache|revision bump/i);
    expect(auth11.semanticReviewStatus).toBe('EXACT');

    const auth12 = byId.get('AUTH12')!;
    expect(auth12.testTitle).toMatch(/SoD/i);
    expect(auth12.semanticReviewStatus).toBe('EXACT');

    const lim03 = byId.get('LIM03')!;
    expect(lim03.testTitle).toMatch(/UNCONFIGURED|LIM03/i);
    expect(lim03.testTitle).not.toMatch(/ingestion disabled/i);
    expect(lim03.semanticReviewStatus).toBe('EXACT');

    const iso03 = byId.get('ISO03')!;
    expect(iso03.testTitle).toMatch(/tenant A cannot read tenant B|cannot leak another tenant/i);
    expect(iso03.testTitle).not.toMatch(/containment OFF/i);
    expect(iso03.semanticReviewStatus).toBe('EXACT');

    const th01 = byId.get('TH01')!;
    expect(th01.semanticEvidenceType).toBe('docs-control-map');
    expect(th01.testTitle).not.toMatch(/includes every required Step 28 matrix ID/i);
    expect(th01.mitigationIds?.length ?? 0).toBeGreaterThan(0);

    const http01 = byId.get('HTTPSEC01')!;
    expect(http01.testTitle).toMatch(/^H01:|H01:/);
    expect(http01.testTitle).not.toMatch(/containment OFF/i);
    expect(http01.semanticReviewStatus).toBe('EXACT');
  });

  it('forbidden reused titles are not used for unrelated high-risk claims', () => {
    const forbidden = [
      {
        title: /containment OFF — disabled routes return tenant_provisioning_disabled/i,
        families: ['ISO', 'HTTPSEC', 'AUTH'],
      },
      {
        title: /includes every required Step 28 matrix ID/i,
        families: ['TH', 'AUTH', 'LIM', 'ISO', 'HTTPSEC'],
      },
    ];
    for (const rule of forbidden) {
      const hits = MATRIX_EVIDENCE.filter(
        (e) =>
          rule.families.some((f) => e.id.startsWith(f)) &&
          rule.title.test(e.testTitle) &&
          e.semanticEvidenceType !== 'docs-control-map',
      ).map((e) => e.id);
      expect(hits).toEqual([]);
    }
  });
});
