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
import {
  ONTOLOGY_CONCEPT_COUNT,
  STEP28_SECURITY_CONCEPT_ONTOLOGY,
  STEP28_TH_DIRECTNESS_PREFERENCES,
  TH_THREAT_CONCEPTS,
  rejectSharedTagWithoutOntologyApproval,
  scanCandidateSemanticMismatches,
  scanConceptLaundering,
  scanDirectEvidenceMappings,
  validateDirectEvidenceMapping,
  validateExactConceptTags,
  validateThreatMitigationConcepts,
} from '../step28-semantic-concepts';

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

  it('narrow closure reviewer IDs use exact concept proofs', () => {
    const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
    expect(byId.get('RL20')!.testTitle).toMatch(/X-Forwarded-For|TRUST_PROXY/i);
    expect(byId.get('RL20')!.testTitle).not.toMatch(/testBypass|RLTEST04/i);
    expect(byId.get('RL20')!.securityConceptTags).toEqual(expect.arrayContaining(['xff-trust-proxy']));

    expect(byId.get('AUTH30')!.testTitle).toMatch(/expired access token/i);
    expect(byId.get('AUTH30')!.testTitle).not.toMatch(/absolute lifetime|refresh when the session/i);
    expect(byId.get('AUTH30')!.securityConceptTags).toEqual(
      expect.arrayContaining(['expired-access-token']),
    );

    expect(byId.get('AUTH38')!.testTitle).toMatch(/permission exists|deny path/i);
    expect(byId.get('AUTH38')!.testTitle).not.toMatch(/unknown account|wrong password/i);
    expect(byId.get('AUTH38')!.securityConceptTags).toEqual(
      expect.arrayContaining(['permission-enumeration-resistance']),
    );

    expect(byId.get('TH24')!.mitigationIds).toEqual(
      expect.arrayContaining(['API10', 'HTTPSEC48', 'HTTPSEC49', 'HTTPSEC50']),
    );
    expect(byId.get('TH30')!.mitigationIds).toEqual(expect.arrayContaining(['IO02', 'PRIV03']));
    expect(byId.get('TH33')!.mitigationIds).toEqual(expect.arrayContaining(['MA16']));
    expect(byId.get('TH35')!.mitigationIds).toEqual(expect.arrayContaining(['IO03', 'IO24']));

    expect(byId.get('TH11')!.mitigationIds).toEqual(expect.arrayContaining(['PVSEC01', 'PVSEC02']));
    expect(byId.get('TH11')!.threatConceptTags).toEqual(
      expect.arrayContaining(['published-plan-version-immutability']),
    );
    expect(byId.get('DEP01')!.securityConceptTags).toEqual(
      expect.arrayContaining(['dependency-audit']),
    );
    expect(byId.get('DEP01')!.securityConceptTags).not.toContain('http-passport-boundary');
    expect(byId.get('TH39')!.mitigationIds).toEqual(expect.arrayContaining(['NOTSEC02', 'NOTSEC03']));
    expect(byId.get('NOTSEC02')!.testTitle).toMatch(/Strategy B|ambiguous|no auto-resend/i);
    expect(byId.get('TH40')!.mitigationIds).toEqual(expect.arrayContaining(['NOTSEC04', 'NOTSEC05']));
    expect(byId.get('NOTSEC04')!.testTitle).toMatch(/C07-B|send-time revalidation/i);
  });

  it('rejects RL20 XFF claim linked to DI bypass test', () => {
    const err = validateExactConceptTags({
      id: 'RL20',
      semanticReviewStatus: 'EXACT',
      securityConceptTags: ['rate-limit-test-bypass'],
      testTitle:
        'RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter',
      assertionAnchor: 'RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter',
    });
    expect(err).toMatch(/RL20/);
  });

  it('rejects AUTH30 expired-access-token claim linked to refresh lifetime test', () => {
    const err = validateExactConceptTags({
      id: 'AUTH30',
      semanticReviewStatus: 'EXACT',
      securityConceptTags: ['refresh-absolute-lifetime'],
      testTitle: 'rejects refresh when the session breached the absolute lifetime',
      assertionAnchor: 'rejects refresh when the session breached the absolute lifetime',
    });
    expect(err).toMatch(/AUTH30/);
  });

  it('rejects AUTH38 permission-enumeration claim linked to login-enumeration test', () => {
    const err = validateExactConceptTags({
      id: 'AUTH38',
      semanticReviewStatus: 'EXACT',
      securityConceptTags: ['login-enumeration-resistance'],
      testTitle: 'returns indistinguishable errors for unknown account and wrong password',
      assertionAnchor: 'returns indistinguishable errors for unknown account and wrong password',
    });
    expect(err).toMatch(/AUTH38/);
  });

  it('rejects TH24 unrelated provisioning mitigations', () => {
    const byId = new Map([
      ['HTTPSEC01', { id: 'HTTPSEC01', securityConceptTags: ['http-passport-boundary', 'notification-privacy'] }],
      ['ISO03', { id: 'ISO03', securityConceptTags: ['tenant-isolation'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH24',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: TH_THREAT_CONCEPTS.TH24,
        mitigationIds: ['HTTPSEC01', 'ISO03'],
      },
      byId,
    );
    expect(err).toMatch(/TH24/);
  });

  it('rejects TH30 unrelated CSV mitigations', () => {
    const byId = new Map([
      ['IO01', { id: 'IO01', securityConceptTags: ['dto-whitelist', 'mass-assignment'] }],
      ['PRIV04', { id: 'PRIV04', securityConceptTags: ['notification-privacy'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH30',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: TH_THREAT_CONCEPTS.TH30,
        mitigationIds: ['IO01', 'PRIV04'],
      },
      byId,
    );
    expect(err).toMatch(/TH30/);
  });

  it('rejects TH33 unrelated prototype/object-key mitigations', () => {
    const byId = new Map([
      ['MA03', { id: 'MA03', securityConceptTags: ['mass-assignment', 'dto-whitelist'] }],
      ['API02', { id: 'API02', securityConceptTags: ['http-passport-boundary'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH33',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: TH_THREAT_CONCEPTS.TH33,
        mitigationIds: ['MA03', 'API02'],
      },
      byId,
    );
    expect(err).toMatch(/TH33/);
  });

  it('rejects TH35 unrelated path/file mitigations', () => {
    const byId = new Map([
      ['FSEC01', { id: 'FSEC01', securityConceptTags: ['notification-privacy'] }],
      ['IO02', { id: 'IO02', securityConceptTags: ['csv-formula-injection', 'export-sanitization'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH35',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: TH_THREAT_CONCEPTS.TH35,
        mitigationIds: ['FSEC01', 'IO02'],
      },
      byId,
    );
    expect(err).toMatch(/TH35/);
  });

  it('threatSemanticMismatchCount is zero and narrow scan confirms zero', () => {
    const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
    let threatSemanticMismatchCount = 0;
    for (const e of MATRIX_EVIDENCE.filter((x) => x.semanticEvidenceType === 'docs-control-map')) {
      if (validateThreatMitigationConcepts(e, byId)) threatSemanticMismatchCount += 1;
    }
    expect(threatSemanticMismatchCount).toBe(0);
    const scan = scanCandidateSemanticMismatches(MATRIX_EVIDENCE);
    expect(scan.confirmed).toEqual([]);
    const laundering = scanConceptLaundering(MATRIX_EVIDENCE);
    expect(laundering.confirmed).toEqual([]);
  });

  it('rejects TH11 mass-assignment as Plan Version immutability mitigation', () => {
    const byId = new Map([
      ['MA01', { id: 'MA01', securityConceptTags: ['mass-assignment', 'dto-whitelist'] }],
      ['MA02', { id: 'MA02', securityConceptTags: ['mass-assignment', 'dto-whitelist'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH11',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: ['mass-assignment'],
        mitigationIds: ['MA01', 'MA02'],
      },
      byId,
    );
    expect(err).toMatch(/TH11/);
  });

  it('rejects TH36 DEP records tagged http-passport-boundary', () => {
    const byId = new Map([
      ['DEP01', { id: 'DEP01', securityConceptTags: ['http-passport-boundary'] }],
      ['DEP02', { id: 'DEP02', securityConceptTags: ['http-passport-boundary'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH36',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: ['http-passport-boundary'],
        mitigationIds: ['DEP01', 'DEP02'],
      },
      byId,
    );
    expect(err).toMatch(/TH36/);
  });

  it('rejects TH39 privacy-only notification mitigations', () => {
    const byId = new Map([
      ['NOTSEC02', { id: 'NOTSEC02', securityConceptTags: ['notification-privacy'] }],
      ['NOTSEC03', { id: 'NOTSEC03', securityConceptTags: ['notification-privacy'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH39',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: ['notification-privacy'],
        mitigationIds: ['NOTSEC02', 'NOTSEC03'],
      },
      byId,
    );
    expect(err).toMatch(/TH39/);
  });

  it('rejects TH40 privacy-only stale-trial mitigations', () => {
    const byId = new Map([
      ['NOTSEC04', { id: 'NOTSEC04', securityConceptTags: ['notification-privacy'] }],
      ['CSEC01', { id: 'CSEC01', securityConceptTags: ['notification-privacy'] }],
    ]);
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH40',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: ['notification-privacy'],
        mitigationIds: ['NOTSEC04', 'CSEC01'],
      },
      byId,
    );
    expect(err).toMatch(/TH40/);
  });

  it('rejects same manually declared tag without ontology approval', () => {
    const err = rejectSharedTagWithoutOntologyApproval({
      threatId: 'TH11',
      sharedTag: 'mass-assignment',
      mitigationId: 'MA01',
      mitigationTags: ['mass-assignment'],
    });
    expect(err).toMatch(/TH11/);
  });

  it('frozen ontology is static and authoritative', () => {
    expect(ONTOLOGY_CONCEPT_COUNT).toBeGreaterThan(30);
    expect(STEP28_SECURITY_CONCEPT_ONTOLOGY['published-plan-version-immutability'].allowedFamilies).toEqual([
      'PVSEC',
    ]);
    expect(STEP28_SECURITY_CONCEPT_ONTOLOGY['dependency-audit'].forbiddenConcepts).toEqual(
      expect.arrayContaining(['http-passport-boundary']),
    );
    expect(TH_THREAT_CONCEPTS.TH11).toEqual(
      expect.arrayContaining(['published-plan-version-immutability']),
    );
    expect(TH_THREAT_CONCEPTS.TH36).toEqual(expect.arrayContaining(['dependency-audit']));
    expect(TH_THREAT_CONCEPTS.TH39).toEqual(expect.arrayContaining(['ambiguous-delivery-state']));
    expect(TH_THREAT_CONCEPTS.TH40).toEqual(expect.arrayContaining(['trial-state-revalidation']));
  });

  it('rejects TH07 SES02/AUTH28 without direct stale-step-up evidence', () => {
    const err = validateDirectEvidenceMapping({
      id: 'TH07',
      semanticEvidenceType: 'docs-control-map',
      mitigationIds: ['SES02', 'AUTH28'],
    });
    expect(err).toMatch(/TH07/);
  });

  it('rejects TH12 generic API10/HTTPSEC48 only', () => {
    const err = validateDirectEvidenceMapping({
      id: 'TH12',
      semanticEvidenceType: 'docs-control-map',
      mitigationIds: ['API10', 'HTTPSEC48'],
    });
    expect(err).toMatch(/TH12/);
  });

  it('rejects TH15 generic API10/HTTPSEC48 only', () => {
    const err = validateDirectEvidenceMapping({
      id: 'TH15',
      semanticEvidenceType: 'docs-control-map',
      mitigationIds: ['API10', 'HTTPSEC48'],
    });
    expect(err).toMatch(/TH15/);
  });

  it('rejects TH16 generic provisioning RBAC/wildcard evidence', () => {
    const err = validateDirectEvidenceMapping({
      id: 'TH16',
      semanticEvidenceType: 'docs-control-map',
      mitigationIds: ['API10', 'HTTPSEC50'],
    });
    expect(err).toMatch(/TH16/);
  });

  it('rejects TH17 AUTH11 authz cache only', () => {
    const err = validateDirectEvidenceMapping({
      id: 'TH17',
      semanticEvidenceType: 'docs-control-map',
      mitigationIds: ['AUTH11'],
    });
    expect(err).toMatch(/TH17/);
  });

  it('rejects generic ontology-compatible evidence when preferred direct mitigation exists', () => {
    expect(STEP28_TH_DIRECTNESS_PREFERENCES.TH07.preferredMitigationIds).toEqual(
      expect.arrayContaining(['API31']),
    );
    const err = validateThreatMitigationConcepts(
      {
        id: 'TH07',
        semanticEvidenceType: 'docs-control-map',
        threatConceptTags: TH_THREAT_CONCEPTS.TH07,
        mitigationIds: ['SES02', 'AUTH28'],
      },
      new Map([
        ['SES02', { id: 'SES02', securityConceptTags: ['stale-step-up-deny'] }],
        ['AUTH28', { id: 'AUTH28', securityConceptTags: ['mfa-step-up-enforcement'] }],
      ]),
    );
    expect(err).toMatch(/TH07/);
  });

  it('direct-evidence mapping failures are zero after remaps', () => {
    const scan = scanDirectEvidenceMappings(MATRIX_EVIDENCE);
    expect(scan.confirmed).toEqual([]);
    const byId = new Map(MATRIX_EVIDENCE.map((e) => [e.id, e]));
    expect(byId.get('TH07')!.mitigationIds).toEqual(expect.arrayContaining(['API31', 'SES09']));
    expect(byId.get('TH12')!.mitigationIds).toEqual(['TENSA06']);
    expect(byId.get('TH15')!.mitigationIds).toEqual(expect.arrayContaining(['SG03']));
    expect(byId.get('TH16')!.mitigationIds).toEqual(expect.arrayContaining(['ER16']));
    expect(byId.get('TH17')!.mitigationIds).toEqual(expect.arrayContaining(['CACHE02']));
  });
});
