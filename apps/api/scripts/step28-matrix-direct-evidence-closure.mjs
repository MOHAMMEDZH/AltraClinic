/**
 * Step 28 direct-evidence TH mapping closure — remap indirect threats to preferred IDs.
 * Evidence metadata only; no product/runtime changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, '../src/modules/security-hardening/step28-matrix-evidence.ts');

const REMAPS = {
  TH07: {
    mids: ['API31', 'SES09'],
    concepts: ['stale-step-up-deny', 'mfa-step-up-enforcement'],
  },
  TH12: {
    mids: ['TENSA06'],
    concepts: ['addon-platform-boundary', 'addon-unauthorized-mutation-deny', 'tenant-addon-self-grant-deny'],
  },
  TH13: {
    mids: ['OVR01', 'TENSA07'],
    concepts: ['override-platform-boundary', 'override-unauthorized-mutation-deny', 'override-sod-deny'],
  },
  TH14: {
    mids: ['SG03', 'SG02'],
    concepts: [
      'subscription-platform-boundary',
      'subscription-unauthorized-mutation-deny',
      'tenant-self-grant-deny',
    ],
  },
  TH15: {
    mids: ['SG03', 'TENSA04'],
    concepts: ['tenant-self-grant-deny', 'platform-commercial-boundary'],
  },
  TH16: {
    mids: ['ER16', 'ER01'],
    concepts: ['eer-resolver-bypass-deny', 'managed-eer-fail-closed', 'no-silent-legacy'],
  },
  TH17: {
    mids: ['CACHE02', 'CACHE01'],
    concepts: ['eer-cache-stale-allow-deny', 'cache-invalidation-fail-safe', 'entitlement-cache-isolation'],
  },
  TH23: {
    mids: ['TENSA09', 'TENSA10'],
    concepts: ['facility-specialty-compat-boundary', 'platform-commercial-boundary'],
  },
  TH27: {
    mids: ['LOG01', 'LOG02'],
    concepts: ['secrets-in-logs-deny', 'output-neutralization'],
  },
  TH29: {
    mids: ['HTTPSEC28', 'PRIV01'],
    concepts: ['notification-secret-leakage-deny', 'notification-privacy'],
  },
  TH31: {
    mids: ['ISO03', 'ISO04'],
    concepts: ['idor-cross-tenant-deny', 'tenant-isolation'],
  },
};

const TAG_FORCE = {
  API31: ['stale-step-up-deny', 'mfa-step-up-enforcement'],
  SES09: ['mfa-step-up-enforcement', 'stale-step-up-deny'],
  TENSA06: ['addon-platform-boundary', 'addon-unauthorized-mutation-deny', 'tenant-addon-self-grant-deny'],
  TENSA07: ['override-platform-boundary', 'override-unauthorized-mutation-deny'],
  OVR01: ['override-sod-deny', 'override-unauthorized-mutation-deny', 'override-platform-boundary'],
  SG02: ['subscription-unauthorized-mutation-deny', 'subscription-platform-boundary', 'tenant-self-grant-deny'],
  SG03: ['tenant-self-grant-deny', 'subscription-platform-boundary', 'platform-commercial-boundary'],
  TENSA04: ['platform-commercial-boundary', 'tenant-self-grant-deny'],
  ER16: ['eer-resolver-bypass-deny', 'managed-eer-fail-closed', 'no-silent-legacy'],
  ER01: ['managed-eer-fail-closed', 'no-silent-legacy', 'eer-resolver-bypass-deny'],
  CACHE01: ['entitlement-cache-isolation', 'eer-cache-stale-allow-deny', 'tenant-isolation'],
  CACHE02: ['eer-cache-stale-allow-deny', 'cache-invalidation-fail-safe', 'entitlement-cache-isolation'],
  TENSA09: ['facility-specialty-compat-boundary', 'platform-commercial-boundary'],
  TENSA10: ['facility-specialty-compat-boundary', 'platform-commercial-boundary'],
  LOG01: ['secrets-in-logs-deny', 'output-neutralization'],
  LOG02: ['secrets-in-logs-deny', 'output-neutralization'],
  HTTPSEC28: ['notification-secret-leakage-deny', 'notification-privacy'],
  PRIV01: ['notification-privacy', 'notification-secret-leakage-deny'],
  ISO03: ['idor-cross-tenant-deny', 'tenant-isolation'],
  ISO04: ['idor-cross-tenant-deny', 'tenant-isolation'],
};

function loadEntries() {
  const prev = fs.readFileSync(SOURCE, 'utf8');
  const start = prev.indexOf('function buildMatrixEvidenceEntries()');
  const returnIdx = prev.indexOf('return [', start);
  const arrStart = returnIdx + 'return '.length;
  const arrEnd = prev.indexOf('] as MatrixEvidenceEntry[]', arrStart);
  if (start < 0 || returnIdx < 0 || arrEnd < 0) throw new Error('Cannot locate matrix evidence array');
  return { prev, arrStart, arrEnd, entries: JSON.parse(prev.slice(arrStart, arrEnd + 1)) };
}

function patch(entry, fields) {
  Object.assign(entry, fields);
  for (const k of Object.keys(entry)) if (entry[k] === undefined) delete entry[k];
}

function main() {
  const { prev, arrStart, arrEnd, entries } = loadEntries();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const before = [];
  for (const [th, cfg] of Object.entries(REMAPS)) {
    const cur = byId.get(th);
    const mids = (cur?.mitigationIds || []).join(',');
    const expected = cfg.mids.join(',');
    if (mids !== expected) before.push(`${th}:${mids}->${expected}`);
  }

  for (const [id, tags] of Object.entries(TAG_FORCE)) {
    if (byId.get(id)) patch(byId.get(id), { securityConceptTags: tags });
  }

  for (const [th, cfg] of Object.entries(REMAPS)) {
    if (!byId.get(th)) continue;
    patch(byId.get(th), {
      mitigationIds: cfg.mids,
      assertionAnchor: `mitigationIds=${cfg.mids.join(',')}`,
      threatConceptTags: cfg.concepts,
      semanticEvidenceType: 'docs-control-map',
      semanticReviewStatus: 'DOCS_ONLY',
      semanticReviewNote: 'Direct-evidence preferred mapping (Step 28 final directness closure)',
    });
  }

  const after = [];
  for (const [th, cfg] of Object.entries(REMAPS)) {
    const cur = byId.get(th);
    const mids = (cur?.mitigationIds || []).join(',');
    if (mids !== cfg.mids.join(',')) after.push(`${th}:${mids}`);
  }

  fs.writeFileSync(SOURCE, prev.slice(0, arrStart) + JSON.stringify(entries, null, 2) + prev.slice(arrEnd + 1));
  console.log(
    JSON.stringify(
      {
        remapped: Object.keys(REMAPS),
        indirectBefore: before.length,
        indirectBeforeIds: before,
        indirectAfter: after.length,
        indirectAfterIds: after,
        TH07: byId.get('TH07')?.mitigationIds,
        TH12: byId.get('TH12')?.mitigationIds,
        TH17: byId.get('TH17')?.mitigationIds,
        TH29: byId.get('TH29')?.mitigationIds,
        TH31: byId.get('TH31')?.mitigationIds,
      },
      null,
      2,
    ),
  );
  if (after.length) process.exit(1);
}

main();
