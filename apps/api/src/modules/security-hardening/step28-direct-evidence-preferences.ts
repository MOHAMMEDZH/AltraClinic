/**
 * Step 28 direct-evidence preference table for TH mappings.
 * When preferred mitigations exist, generic ontology-compatible fallbacks are rejected.
 */

export type DirectnessPreference = {
  threatId: string;
  preferredMitigationIds: string[];
  preferredEvidenceFamilies: string[];
  /** Exact mitigation ID sets that are known-indirect and must be rejected. */
  rejectedMitigationSets: string[][];
  classificationHint: 'DIRECT' | 'ACCEPTABLE COMPOSITE';
};

/**
 * Frozen preference table for threats where generic auth/RBAC was previously laundered in.
 * Not derived from the record under validation.
 */
export const STEP28_TH_DIRECTNESS_PREFERENCES: Record<string, DirectnessPreference> = {
  TH07: {
    threatId: 'TH07',
    preferredMitigationIds: ['API31', 'SES09'],
    preferredEvidenceFamilies: ['API', 'SES'],
    rejectedMitigationSets: [['SES02', 'AUTH28'], ['AUTH28', 'SES02']],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH12: {
    threatId: 'TH12',
    preferredMitigationIds: ['TENSA06'],
    preferredEvidenceFamilies: ['TENSA', 'OVR'],
    rejectedMitigationSets: [
      ['API10', 'HTTPSEC48'],
      ['HTTPSEC48', 'API10'],
    ],
    classificationHint: 'DIRECT',
  },
  TH13: {
    threatId: 'TH13',
    preferredMitigationIds: ['OVR01', 'TENSA07'],
    preferredEvidenceFamilies: ['OVR', 'TENSA'],
    rejectedMitigationSets: [
      ['API10', 'HTTPSEC48'],
      ['HTTPSEC48', 'API10'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH14: {
    threatId: 'TH14',
    preferredMitigationIds: ['SG03', 'SG02'],
    preferredEvidenceFamilies: ['SG', 'TENSA'],
    rejectedMitigationSets: [
      ['API10', 'HTTPSEC49'],
      ['HTTPSEC49', 'API10'],
      ['API10', 'HTTPSEC48'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH15: {
    threatId: 'TH15',
    preferredMitigationIds: ['SG03', 'TENSA04'],
    preferredEvidenceFamilies: ['SG', 'TENSA'],
    rejectedMitigationSets: [
      ['API10', 'HTTPSEC48'],
      ['HTTPSEC48', 'API10'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH16: {
    threatId: 'TH16',
    preferredMitigationIds: ['ER16', 'ER01'],
    preferredEvidenceFamilies: ['ER'],
    rejectedMitigationSets: [
      ['API10', 'HTTPSEC50'],
      ['HTTPSEC50', 'API10'],
      ['API10', 'HTTPSEC48'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH17: {
    threatId: 'TH17',
    preferredMitigationIds: ['CACHE02', 'CACHE01'],
    preferredEvidenceFamilies: ['CACHE'],
    rejectedMitigationSets: [['AUTH11']],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH19: {
    threatId: 'TH19',
    preferredMitigationIds: ['CACHE01', 'CACHE02'],
    preferredEvidenceFamilies: ['CACHE'],
    rejectedMitigationSets: [['AUTH11'], ['AUTH11', 'AUTH28'], ['SES02', 'AUTH11']],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH23: {
    threatId: 'TH23',
    preferredMitigationIds: ['TENSA09', 'TENSA10'],
    preferredEvidenceFamilies: ['TENSA'],
    rejectedMitigationSets: [
      ['API01', 'HTTPSEC39'],
      ['HTTPSEC39', 'API01'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH27: {
    threatId: 'TH27',
    preferredMitigationIds: ['LOG01', 'LOG02'],
    preferredEvidenceFamilies: ['LOG'],
    rejectedMitigationSets: [
      ['IO02', 'LOG01'], // CSV formula is not secrets-in-logs primary proof
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH29: {
    threatId: 'TH29',
    preferredMitigationIds: ['HTTPSEC28', 'PRIV01'],
    preferredEvidenceFamilies: ['HTTPSEC', 'PRIV', 'NOTSEC'],
    rejectedMitigationSets: [
      ['NOTSEC01', 'PRIV04'],
      ['PRIV04', 'NOTSEC01'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
  TH31: {
    threatId: 'TH31',
    preferredMitigationIds: ['ISO03', 'ISO04'],
    preferredEvidenceFamilies: ['ISO'],
    rejectedMitigationSets: [
      ['ISO03', 'HTTPSEC23'], // pagination ≠ IDOR
      ['HTTPSEC23', 'ISO03'],
    ],
    classificationHint: 'ACCEPTABLE COMPOSITE',
  },
};

export function familyOfMitigationId(id: string): string {
  const m = id.match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

/**
 * Prefer direct evidence. Reject known generic fallback sets when preferences exist.
 */
export function validateDirectEvidenceMapping(entry: {
  id: string;
  semanticEvidenceType?: string;
  mitigationIds?: string[];
}): string | null {
  if (entry.semanticEvidenceType !== 'docs-control-map') return null;
  const pref = STEP28_TH_DIRECTNESS_PREFERENCES[entry.id];
  if (!pref) return null;
  const mids = entry.mitigationIds ?? [];
  if (!mids.length) return `${entry.id}: missing mitigationIds for directness check`;

  for (const bad of pref.rejectedMitigationSets) {
    if (sameIdSet(mids, bad)) {
      if (entry.id === 'TH19' && sameIdSet(bad, ['AUTH11'])) {
        return `${entry.id}: authzRevision cache invalidation is not EER cache-poisoning resistance; preferred=${pref.preferredMitigationIds.join(',')}`;
      }
      return `${entry.id}: generic/indirect mitigation set rejected; preferred=${pref.preferredMitigationIds.join(',')}`;
    }
  }

  const hasPreferredId = mids.some((id) => pref.preferredMitigationIds.includes(id));
  const hasPreferredFamily = mids.some((id) =>
    pref.preferredEvidenceFamilies.includes(familyOfMitigationId(id)),
  );
  if (!hasPreferredId && !hasPreferredFamily) {
    return `${entry.id}: missing preferred direct evidence family/id (need one of ${pref.preferredMitigationIds.join(',')})`;
  }

  // If preferred IDs are listed, require at least one preferred ID when the set is not purely preferred-family domain evidence.
  // For ER/CACHE/SG/TENSA/OVR/ISO/LOG, family match alone can be enough if no rejected set matched.
  if (pref.preferredMitigationIds.length && !hasPreferredId) {
    // Allow family-only when every mitigation is from preferred families (domain-direct composite).
    const allPreferredFamily = mids.every((id) =>
      pref.preferredEvidenceFamilies.includes(familyOfMitigationId(id)),
    );
    if (!allPreferredFamily) {
      return `${entry.id}: generic ontology-compatible evidence rejected when preferred direct mitigation exists`;
    }
  }

  return null;
}

/** Scan TH records for indirect mappings relative to the preference table. */
export function scanDirectEvidenceMappings(
  entries: Array<{ id: string; semanticEvidenceType?: string; mitigationIds?: string[] }>,
): { candidates: string[]; confirmed: string[] } {
  const candidates: string[] = [];
  const confirmed: string[] = [];
  for (const e of entries) {
    if (e.semanticEvidenceType !== 'docs-control-map') continue;
    if (!STEP28_TH_DIRECTNESS_PREFERENCES[e.id]) continue;
    candidates.push(e.id);
    const err = validateDirectEvidenceMapping(e);
    if (err) confirmed.push(`${e.id}:indirect`);
  }
  return { candidates: [...new Set(candidates)], confirmed: [...new Set(confirmed)] };
}
