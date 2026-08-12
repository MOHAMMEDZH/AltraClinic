import {
  assertMatrixEvidenceComplete,
  MATRIX_EVIDENCE,
  STEP28_MATRIX_EVIDENCE_IDS,
} from '../step28-matrix-evidence';

describe('Step 28 matrix evidence validation', () => {
  it('assertMatrixEvidenceComplete passes for full ID universe', () => {
    expect(() => assertMatrixEvidenceComplete()).not.toThrow();
  });

  it('has no duplicate IDs', () => {
    const ids = MATRIX_EVIDENCE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(STEP28_MATRIX_EVIDENCE_IDS.length);
  });

  it('every ID has non-empty canonicalMeaning and testFile or N/A reason', () => {
    for (const e of MATRIX_EVIDENCE) {
      expect(e.canonicalMeaning.trim().length).toBeGreaterThan(0);
      if (e.applicability === 'na') {
        expect((e.naReason ?? '').trim().length).toBeGreaterThan(0);
      } else {
        expect(e.testFile.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('includes RLTEST, TENSA, and CSP families', () => {
    expect(STEP28_MATRIX_EVIDENCE_IDS).toEqual(
      expect.arrayContaining(['RLTEST01', 'RLTEST08', 'TENSA01', 'TENSA20', 'CSP01', 'CSP16']),
    );
  });
});
