/**
 * Step 28 concept-ontology closure — patch TH mappings + family tags; eliminate tag laundering.
 * Evidence metadata only; no product/runtime changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const SOURCE = path.join(apiRoot, 'src/modules/security-hardening/step28-matrix-evidence.ts');

function familyOf(id) {
  const m = String(id).match(/^[A-Z]+/);
  return m ? m[0] : 'UNKNOWN';
}

function tagsOverlap(a, b) {
  if (!a?.length || !b?.length) return false;
  const set = new Set(a);
  return b.some((t) => set.has(t));
}

const TH_ONTOLOGY = {
  TH01: { concepts: ['http-passport-boundary'], mids: ['AUTH18', 'HTTPSEC05'] },
  TH02: { concepts: ['http-passport-boundary', 'provisioning-rbac'], mids: ['AUTH01', 'HTTPSEC04'] },
  TH03: { concepts: ['tenant-isolation'], mids: ['ISO03', 'ISO01'] },
  TH04: { concepts: ['role-name-bypass-deny'], mids: ['AUTH02', 'HTTPSEC49'] },
  TH05: { concepts: ['wildcard-permission-deny'], mids: ['AUTH07', 'HTTPSEC50'] },
  TH06: { concepts: ['expired-access-token', 'refresh-absolute-lifetime'], mids: ['AUTH30', 'AUTH29'] },
  TH07: { concepts: ['http-passport-boundary'], mids: ['SES02', 'AUTH28'] },
  TH08: { concepts: ['http-passport-boundary'], mids: ['CSRF01'] },
  TH09: { concepts: ['cors-allowlist'], mids: ['CORS01', 'CORS02'] },
  TH10: { concepts: ['xff-trust-proxy', 'rate-limit-test-bypass'], mids: ['RL20', 'RLTEST01'] },
  TH11: {
    concepts: ['published-plan-version-immutability', 'plan-version-mutation-deny'],
    mids: ['PVSEC01', 'PVSEC02'],
  },
  TH12: { concepts: ['provisioning-rbac'], mids: ['API10', 'HTTPSEC48'] },
  TH13: { concepts: ['provisioning-rbac'], mids: ['API10', 'HTTPSEC48'] },
  TH14: { concepts: ['provisioning-rbac'], mids: ['API10', 'HTTPSEC49'] },
  TH15: { concepts: ['provisioning-rbac'], mids: ['API10', 'HTTPSEC48'] },
  TH16: { concepts: ['provisioning-rbac'], mids: ['API10', 'HTTPSEC50'] },
  TH17: { concepts: ['authz-cache-revision'], mids: ['AUTH11'] },
  TH18: { concepts: ['tenant-isolation'], mids: ['ISO03', 'CACHE01'] },
  TH19: { concepts: ['authz-cache-revision'], mids: ['AUTH11', 'CACHE01'] },
  TH20: { concepts: ['limit-fail-closed'], mids: ['LIM03', 'LIM04'] },
  TH21: { concepts: ['limit-fail-closed'], mids: ['LIM03', 'LIM02'] },
  TH22: { concepts: ['feature-flag-not-entitlement'], mids: ['FF01', 'FF02'] },
  TH23: { concepts: ['http-passport-boundary', 'provisioning-rbac'], mids: ['API01', 'HTTPSEC39'] },
  TH24: {
    concepts: [
      'provisioning-rbac',
      'provisioning-permission-deny',
      'role-name-bypass-deny',
      'wildcard-permission-deny',
    ],
    mids: ['API10', 'HTTPSEC48', 'HTTPSEC49', 'HTTPSEC50'],
  },
  TH25: { concepts: ['suspended-user', 'http-passport-boundary'], mids: ['AUTH10', 'HTTPSEC08'] },
  TH26: { concepts: ['http-passport-boundary'], mids: ['AUDSEC01', 'AUDSEC02'] },
  TH27: { concepts: ['output-neutralization'], mids: ['IO02', 'LOG01'] },
  TH28: { concepts: ['notification-privacy'], mids: ['PRIV01', 'PRIV04'] },
  TH29: { concepts: ['notification-privacy'], mids: ['NOTSEC01', 'PRIV04'] },
  TH30: {
    concepts: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
    mids: ['IO02', 'PRIV03'],
  },
  TH31: { concepts: ['tenant-isolation'], mids: ['ISO03', 'HTTPSEC23'] },
  TH32: { concepts: ['mass-assignment', 'dto-whitelist'], mids: ['MA01', 'MA02'] },
  TH33: { concepts: ['prototype-pollution', 'dangerous-object-key'], mids: ['MA16'] },
  TH34: { concepts: ['xff-trust-proxy'], mids: ['RL20', 'RL02'] },
  TH35: {
    concepts: ['path-traversal', 'absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
    mids: ['IO03', 'IO24'],
  },
  TH36: {
    concepts: [
      'dependency-audit',
      'supply-chain-risk',
      'critical-high-vulnerability-gate',
      'dependency-classification',
    ],
    mids: ['DEP01', 'DEP02'],
  },
  TH37: { concepts: ['rate-limit-test-bypass'], mids: ['HOOK01', 'RLTEST01'] },
  TH38: { concepts: ['rate-limit-test-bypass'], mids: ['RLTEST01', 'HOOK02'] },
  TH39: {
    concepts: [
      'ambiguous-delivery-state',
      'no-blind-resend',
      'explicit-manual-retry',
      'notification-idempotency-safety',
    ],
    mids: ['NOTSEC02', 'NOTSEC03'],
  },
  TH40: {
    concepts: [
      'trial-state-revalidation',
      'stale-notification-prevention',
      'send-time-state-check',
      'converted-trial-no-expiry-send',
    ],
    mids: ['NOTSEC04', 'NOTSEC05'],
  },
};

const FAMILY_TAGS = {
  PVSEC: ['published-plan-version-immutability', 'plan-version-mutation-deny'],
  DEP: [
    'dependency-audit',
    'supply-chain-risk',
    'critical-high-vulnerability-gate',
    'dependency-classification',
  ],
  MA: ['mass-assignment', 'dto-whitelist'],
  ISO: ['tenant-isolation'],
  CORS: ['cors-allowlist'],
  LIM: ['limit-fail-closed'],
  FF: ['feature-flag-not-entitlement'],
  RLTEST: ['rate-limit-test-bypass'],
  HOOK: ['rate-limit-test-bypass'],
};

function loadEntries() {
  const prev = fs.readFileSync(SOURCE, 'utf8');
  const start = prev.indexOf('function buildMatrixEvidenceEntries()');
  const returnIdx = prev.indexOf('return [', start);
  const arrStart = returnIdx + 'return '.length;
  const arrEnd = prev.indexOf('] as MatrixEvidenceEntry[]', arrStart);
  if (start < 0 || returnIdx < 0 || arrEnd < 0) throw new Error('Cannot locate matrix evidence array');
  const entries = JSON.parse(prev.slice(arrStart, arrEnd + 1));
  return { prev, arrStart, arrEnd, entries };
}

function patch(entry, fields) {
  Object.assign(entry, fields);
  for (const k of Object.keys(entry)) {
    if (entry[k] === undefined) delete entry[k];
  }
}

function scanLaundering(entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const confirmed = [];
  for (const e of entries) {
    const fam = familyOf(e.id);
    const tags = e.securityConceptTags || [];
    if (fam === 'DEP' && tags.includes('http-passport-boundary')) confirmed.push(`${e.id}:dep-http`);
    if (fam === 'PVSEC' && tags.includes('http-passport-boundary')) confirmed.push(`${e.id}:pvsec-http`);
    if (e.id === 'TH11' && (e.mitigationIds || []).some((id) => id.startsWith('MA'))) {
      confirmed.push('TH11:ma');
    }
    if (e.id === 'TH36') {
      for (const mid of e.mitigationIds || []) {
        const m = byId.get(mid);
        if (m?.securityConceptTags?.includes('http-passport-boundary')) confirmed.push('TH36:http');
      }
    }
    if (e.id === 'TH39' || e.id === 'TH40') {
      const allPrivacy = (e.mitigationIds || []).every((id) => {
        const m = byId.get(id);
        return (
          m?.securityConceptTags?.includes('notification-privacy') &&
          !(m.securityConceptTags || []).some((t) =>
            String(t).includes('ambiguous') ||
            String(t).includes('trial') ||
            String(t).includes('resend') ||
            String(t).includes('retry'),
          )
        );
      });
      if (allPrivacy) confirmed.push(`${e.id}:privacy`);
    }
  }
  return [...new Set(confirmed)];
}

function main() {
  const { prev, arrStart, arrEnd, entries } = loadEntries();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const before = scanLaundering(entries);

  // Family tag corrections
  for (const e of entries) {
    const fam = familyOf(e.id);
    if (FAMILY_TAGS[fam]) {
      patch(e, { securityConceptTags: FAMILY_TAGS[fam] });
    }
  }

  // Specific executable ID tags
  const force = {
    DEP01: FAMILY_TAGS.DEP,
    DEP02: FAMILY_TAGS.DEP,
    PVSEC01: FAMILY_TAGS.PVSEC,
    PVSEC02: FAMILY_TAGS.PVSEC,
    AUTH29: ['refresh-absolute-lifetime'],
    AUTH30: ['expired-access-token'],
    AUTH11: ['authz-cache-revision'],
    AUTH02: ['role-name-bypass-deny'],
    AUTH07: ['wildcard-permission-deny'],
    AUTH10: ['suspended-user'],
    RL20: ['xff-trust-proxy'],
    RL02: ['xff-trust-proxy'],
    RLTEST01: ['rate-limit-test-bypass'],
    IO02: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
    IO03: ['absolute-path-redaction', 'file-path-containment', 'safe-file-resolution'],
    IO24: ['path-traversal', 'file-path-containment', 'safe-file-resolution'],
    PRIV03: ['csv-formula-injection', 'export-sanitization', 'output-neutralization'],
    PRIV01: ['notification-privacy'],
    PRIV04: ['notification-privacy'],
    MA16: ['prototype-pollution', 'dangerous-object-key', 'dto-whitelist'],
    CACHE01: ['authz-cache-revision', 'tenant-isolation'],
    LOG01: ['output-neutralization'],
    API10: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
    HTTPSEC48: ['provisioning-rbac', 'provisioning-permission-deny', 'http-passport-boundary'],
    HTTPSEC49: ['provisioning-rbac', 'role-name-bypass-deny', 'http-passport-boundary'],
    HTTPSEC50: ['provisioning-rbac', 'wildcard-permission-deny', 'http-passport-boundary'],
    NOTSEC01: ['notification-privacy'],
    // TH39 Strategy B / manual retry
    NOTSEC02: [
      'ambiguous-delivery-state',
      'no-blind-resend',
      'notification-idempotency-safety',
    ],
    NOTSEC03: ['explicit-manual-retry', 'no-blind-resend', 'notification-idempotency-safety'],
    // TH40 C07 trial revalidation
    NOTSEC04: [
      'trial-state-revalidation',
      'stale-notification-prevention',
      'send-time-state-check',
      'converted-trial-no-expiry-send',
    ],
    NOTSEC05: [
      'trial-state-revalidation',
      'stale-notification-prevention',
      'converted-trial-no-expiry-send',
      'send-time-state-check',
    ],
  };
  for (const [id, tags] of Object.entries(force)) {
    if (byId.get(id)) patch(byId.get(id), { securityConceptTags: tags });
  }

  // Relink NOTSEC02/03/04/05 to real Strategy B / C07 evidence
  patch(byId.get('NOTSEC02'), {
    canonicalMeaning: 'Strategy B durable ambiguous delivery; no automatic resend (I16)',
    testFile:
      'apps/api/src/modules/platform-notifications/tests/platform-notifications-idempotency.postgres.integration.spec.ts',
    testTitle: 'I16: provider_accept_then_ack_loss → durable ambiguous; no auto-resend (Strategy B)',
    assertionAnchor: 'I16: provider_accept_then_ack_loss → durable ambiguous; no auto-resend (Strategy B)',
    attackOrFailure: 'provider_accept_then_ack_loss ambiguous state then blind auto-resend',
    expectedResult: 'status=ambiguous; automatic providerΔ=0',
    routeModuleControl: 'platform-notifications Strategy B ambiguous delivery',
    linkageMode: 'exact-title',
    securityConceptTags: force.NOTSEC02,
  });
  patch(byId.get('NOTSEC03'), {
    canonicalMeaning: 'Explicit manual retry required to requeue dead-lettered notification job (R16)',
    testFile:
      'apps/api/src/modules/platform-notifications/tests/platform-notifications-retry.postgres.integration.spec.ts',
    testTitle: 'R16: Operations-policy manual retry (permission + reason) requeues a dead-lettered job and completes it',
    assertionAnchor:
      'R16: Operations-policy manual retry (permission + reason) requeues a dead-lettered job and completes it',
    attackOrFailure: 'blind automatic resend without explicit manual retry',
    expectedResult: 'only explicit manual retry requeues; no blind auto-resend',
    routeModuleControl: 'platform-notifications explicit manual retry',
    linkageMode: 'exact-title',
    securityConceptTags: force.NOTSEC03,
  });
  patch(byId.get('NOTSEC04'), {
    canonicalMeaning: 'C07 send-time Trial revalidation suppresses expiry email after conversion',
    testFile:
      'apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts',
    testTitle: 'C07-B: queued ACTIVE intent; convert; send-time revalidation suppresses (emailΔ=0)',
    assertionAnchor: 'C07-B: queued ACTIVE intent; convert; send-time revalidation suppresses (emailΔ=0)',
    attackOrFailure: 'stale trialExpiry send after Trial CONVERTED',
    expectedResult: 'send-time suppress; emailΔ=0; trial_obsolete:CONVERTED',
    routeModuleControl: 'platform-notifications C07 send-time Trial revalidation',
    linkageMode: 'exact-title',
    securityConceptTags: force.NOTSEC04,
  });
  patch(byId.get('NOTSEC05'), {
    canonicalMeaning: 'C07 converted Trial obsolete-suppress prevents expiry intent/email',
    testFile:
      'apps/api/src/modules/platform-notifications/tests/platform-notifications-concurrency.postgres.integration.spec.ts',
    testTitle: 'C07-A: convert first; trialExpiry adapter obsolete-suppress → intentΔ=0, emailΔ=0',
    assertionAnchor: 'C07-A: convert first; trialExpiry adapter obsolete-suppress → intentΔ=0, emailΔ=0',
    attackOrFailure: 'trialExpiry after CONVERTED still emits expiry notification',
    expectedResult: 'adapter obsolete-suppress; intentΔ=0 emailΔ=0',
    routeModuleControl: 'platform-notifications C07 converted-trial obsolete suppress',
    linkageMode: 'exact-title',
    securityConceptTags: force.NOTSEC05,
  });

  // Apply all TH ontology mappings
  for (const [th, cfg] of Object.entries(TH_ONTOLOGY)) {
    if (!byId.get(th)) continue;
    patch(byId.get(th), {
      mitigationIds: cfg.mids,
      assertionAnchor: `mitigationIds=${cfg.mids.join(',')}`,
      threatConceptTags: cfg.concepts,
      semanticEvidenceType: 'docs-control-map',
      semanticReviewStatus: 'DOCS_ONLY',
    });
  }

  // Ensure remaining DEP* get dependency tags (not only 01/02)
  for (const e of entries) {
    if (familyOf(e.id) === 'DEP') patch(e, { securityConceptTags: FAMILY_TAGS.DEP });
    if (familyOf(e.id) === 'PVSEC') patch(e, { securityConceptTags: FAMILY_TAGS.PVSEC });
  }

  const after = scanLaundering(entries);

  // ontology pass check (inline)
  let ontologyFailures = 0;
  for (const [th, cfg] of Object.entries(TH_ONTOLOGY)) {
    for (const mid of cfg.mids) {
      const m = byId.get(mid);
      if (!m || !tagsOverlap(cfg.concepts, m.securityConceptTags)) ontologyFailures += 1;
    }
  }

  const next =
    prev.slice(0, arrStart) +
    JSON.stringify(entries, null, 2) +
    prev.slice(arrEnd + 1);
  fs.writeFileSync(SOURCE, next, 'utf8');

  console.log(
    JSON.stringify(
      {
        total: entries.length,
        launderingBefore: before.length,
        launderingBeforeIds: before,
        launderingAfter: after.length,
        launderingAfterIds: after,
        ontologyFailures,
        TH11: byId.get('TH11')?.mitigationIds,
        TH36: byId.get('TH36')?.threatConceptTags,
        TH39: byId.get('TH39')?.mitigationIds,
        TH40: byId.get('TH40')?.mitigationIds,
        DEP01_tags: byId.get('DEP01')?.securityConceptTags,
        NOTSEC02_title: byId.get('NOTSEC02')?.testTitle,
        NOTSEC04_title: byId.get('NOTSEC04')?.testTitle,
      },
      null,
      2,
    ),
  );
  if (after.length || ontologyFailures) process.exit(1);
}

main();
