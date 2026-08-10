# Phase 44 — Architecture Review and Approval

**Document type:** Architecture governance — review, decision resolution, freeze  
**Date:** 2026-07-18  
**Capability:** API Keys & Integrations Center  
**Dynamic Platform phase:** **44**  
**Review posture:** Independent governance review against repository SSOT  
**Production business logic (44b+):** **None** · Phase **44a foundation** landed separately (contracts-only)

---

## 1. Executive Review Summary

Phase 44 proposes an enterprise **API Keys & Integrations Center**: credential lifecycle, deny-by-default scopes, service accounts, outbound/inbound webhooks, quotas, and a Settings operations hub — consuming Auth, RBAC, Licensing, Feature Flags, Activity, Audit, Notification intents, and Health **without** redesigning Phases 41–43.

The proposed architecture was **sufficiently complete and consistent** for freeze after resolving critical open decisions. Legacy Settings keys are treated as foundation with a **restrictive migration** that cannot silently escalate privileges. Queue ownership is explicit and isolated. Secret handling forbids plaintext persistence.

**Overall verdict:**

# PASS — PHASE 44 ARCHITECTURE APPROVED AND FROZEN
# PHASE 44A–44F COMPLETE · PRODUCTION ACCEPTED · RELEASE 44.0 READY
# FEATURE FLAG DEFAULT OFF

Foundation guide: [`API_KEYS_INTEGRATIONS_FOUNDATION.md`](./API_KEYS_INTEGRATIONS_FOUNDATION.md)  
Credential Engine: [`API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md`](./API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md)  
Webhook Engine: [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md)  
Gateway & Quotas: [`API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md`](./API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md)  
Operations UI: [`API_KEYS_INTEGRATIONS_OPERATIONS_UI.md`](./API_KEYS_INTEGRATIONS_OPERATIONS_UI.md)  
Production Acceptance: [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md)  
Release: [`RELEASE_44_0.md`](./RELEASE_44_0.md)
---

## 2. Documents Reviewed

| Document | Role |
|----------|------|
| [`PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md) | Discovery & readiness |
| [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md) | Architecture SSOT (updated to APPROVED AND FROZEN) |
| Companion frozen SSOTs | Notification (41), Import/Export (42), Backup & Restore (43), Activity, Audit, Licensing, Module Management, Background |
| Codebase spot-check (read-only) | Settings `createApiKey` (SHA-256, JSON storage); Notification webhook HMAC/SSRF; Settings webhook test (weak) |

---

## 3. Architecture Quality Assessment

| Area | Assessment |
|------|------------|
| Numbering | **Pass** — Phase 44 unambiguous; Phase 43 remains BR |
| Bounded contexts | **Pass** — clear split from Notification delivery webhooks |
| Domain model | **Pass** — aggregates, lifecycle, ports defined |
| Credential security | **Pass** — hash+pepper, one-time reveal, constant-time |
| Scopes / RBAC | **Pass** — deny-by-default; `api.integrations` |
| Webhooks | **Pass** — SSRF, HMAC, skew, retry/DLQ, dedicated queue |
| Migration | **Pass** — dual-read/write + restrictive scope remap + rollback |
| Observability / platforms | **Pass** — contracts defined |
| 44a precision | **Pass** — entry/exit criteria explicit |
| Ambiguity on critical path | **Cleared** by Decision Register |

---

## 4. Security Review

| Control | Status |
|---------|--------|
| No raw API key persistence | **Required / frozen** |
| No plaintext integration secrets | **Required / frozen** (envelope encryption) |
| Constant-time verify | **Required / frozen** |
| Tenant bind on every credential use | **Required / frozen** |
| Deny unknown scopes | **Required / frozen** |
| High-risk scope assignment gated | **Required** (`approve` / owner); two-person dual-control deferred |
| SSRF on webhook URLs | **Required / frozen** |
| Replay protection (timestamp skew ≤ 300s) | **Required / frozen** |
| Fail closed on missing flag/license/pepper | **Required / frozen** |

**Threat model** in SSOT §19 accepted for 44a entry; ops runbooks remain a later documentation deliverable (not a 44a blocker).

---

## 5. Boundary and Dependency Review

| Dependency | Rule |
|------------|------|
| Phase 41 Notification Delivery | **Frozen** — reuse SSRF/HMAC *patterns* only; do not modify engine/queue |
| Phase 42 Import/Export | **Frozen** — may be *scoped* by keys later; no IE redesign |
| Phase 43 Backup & Restore | **Frozen** — may be *scoped* by keys later; no BR redesign |
| Auth (human JWT/MFA) | Extend with API-key strategy; do not replace human login |
| Workflow webhook actions | Must eventually use Center credentials; no Workflow SoR takeover in 44a |

---

## 6. Decision Register

### 6.1 Critical — RESOLVED

| ID | Selected option | Rationale (summary) | Rejected | Constraints |
|----|-----------------|---------------------|----------|-------------|
| **OD-HASH** | SHA-256(pepper \|\| raw) + constant-time compare | High-entropy keys; pepper vs DB dump; Argon2 too costly per request | Plain SHA-256; Argon2id on request path | `API_CREDENTIAL_PEPPER_REF`; algo id `sha256_pepper_v1` |
| **OD-GRACE** | **24h** rotation grace | Ops continuity vs exposure | 0h; 72h | Revoke still immediate |
| **OD-QUEUE** | BullMQ **`integrations-webhooks`** | Isolation from 41/42/43 queues | Shared queues; Background as SoR | 44a reserve only; 44c wire |
| **OD-SECRET-STORE** | Hash-only keys; AES-256-GCM envelope for recoverable secrets | Signing needs recoverable webhook secrets | Plaintext; hash-only webhook secrets | `INTEGRATIONS_SECRET_KEY_REF` |
| **OD-MIGRATE** | Dual-read/dual-write; legacy → **`ops.read` only** | No silent privilege escalation | Big-bang; copy `write`→PHI write | Rollback via legacy read sub-flag; Audit imports |
| **OD-AUTHN** | `Authorization: Bearer` primary; `X-Api-Key` alternate; `bk_`/`bki_` prefix | Standard + tooling compat; distinguish JWT | JWT-as-key; unprefixed secrets | Fail closed if flag/pepper/license missing |

### 6.2 Deferred — DEFERRED WITH EXPLICIT BOUNDARY (non-blocking for 44a)

| ID | Boundary |
|----|----------|
| **OD-PAT** | No PATs in 44a–44e |
| **OD-OAUTH** | No OAuth client registry in Phase 44 |
| **OD-DUAL** | Two-person approval deferred; high-risk scopes still need `approve`/owner to assign |
| **OD-BRANCH** | Optional column OK; enforcement deferred; v1 tenant-scoped |
| **OD-REDIS** | In-process limiter OK for 44d single-node; Redis later |
| **OD-MTLS** | Not in Phase 44 |

### 6.3 Blocking

**None.**

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Migrated keys weaker than operators expect | Explicit re-scope UX; docs; Audit |
| Pepper loss | Health not-ready; break-glass rotate-all runbook (later ops doc) |
| Duplicate webhook semantics vs Phase 41 | Boundary table enforced in review |
| In-process rate limits | Documented; OD-REDIS deferred |
| Scope catalog growth | Start coarse; deny unknown |

---

## 8. Required Implementation Guardrails (all sub-phases)

1. Do not modify Phases 41–43 engines or their queues.  
2. Do not persist raw API keys or plaintext integration secrets.  
3. Do not enable `API_KEYS_INTEGRATIONS_CENTER_ENABLED` by default.  
4. Do not wire `integrations-webhooks` consumers in 44a.  
5. Do not implement API-key gateway enforcement in 44a.  
6. Do not auto-map legacy `write` to PHI scopes.  
7. Do not introduce PAT/OAuth/mTLS in 44a–44e without a new architecture revision.  
8. Activity/Audit must never log raw secrets.  
9. Fail closed on missing pepper/secret key ref when Center enabled.  
10. TenantId required on every aggregate and authn decision.

---

## 9. Phase 44a Entry Criteria

1. This approval document published.  
2. SSOT status **APPROVED AND FROZEN**.  
3. Critical ODs resolved (above).  
4. Deferred ODs bounded.  
5. No production implementation performed during review (**met**).

### Phase 44a Exit Criteria

See SSOT §33 Exit — module, flags, RBAC, licensing contracts, EffectiveIntegrationsView, health with queue reserved/`wired:false`, contracts-only Activity/Audit/Notification, foundation tests, foundation docs.

### Later sub-phases

**44b–44f remain NOT AUTHORIZED** until their prerequisites in SSOT §32 are met.

---

## 10. Approval Gates Checklist

| Gate | Result |
|------|--------|
| G1 Phase numbering aligned | **PASS** |
| G2 Phases 41–43 frozen | **PASS** |
| G3 Critical ODs resolved | **PASS** |
| G4 No plaintext credential/secret persistence | **PASS** |
| G5 Tenant isolation enforceable | **PASS** |
| G6 Scope deny-by-default | **PASS** |
| G7 Queue ownership/isolation explicit | **PASS** |
| G8 Legacy migration + rollback | **PASS** |
| G9 Flag/license/RBAC/Audit/Activity/Health/Observability | **PASS** |
| G10 44a entry/exit precise | **PASS** |
| G11 No production implementation during review | **PASS** |
| G12 Deferred decisions non-blocking for 44a | **PASS** |

---

## 11. Approval Verdict

**PASS — PHASE 44 ARCHITECTURE APPROVED AND FROZEN**  
**PHASE 44A–44F COMPLETE** · **PRODUCTION ACCEPTED** · **RELEASE 44.0 READY** (flag default OFF)

| Confirmation | |
|--------------|--|
| Architecture status | **APPROVED AND FROZEN** |
| Approval date | **2026-07-18** |
| Production Acceptance | [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md) |
| Release package | [`RELEASE_44_0.md`](./RELEASE_44_0.md) |
| Completed implementation scope | **Phase 44a–44e** (+ 44f acceptance) |
| Feature flag default | **OFF** (`API_KEYS_INTEGRATIONS_CENTER_ENABLED`) |
| Enablement | Controlled post-acceptance only |

---

## 12. Document Freeze Record

| Artifact | Freeze action |
|----------|---------------|
| `docs/API_KEYS_INTEGRATIONS_ARCHITECTURE.md` | Status → **APPROVED AND FROZEN**; Decision Register locked |
| `docs/PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md` | Outcome → approved; 44a authorized |
| `docs/PHASE_44_ARCHITECTURE_REVIEW_AND_APPROVAL.md` | This record |

**Change control:** Amendments to frozen critical decisions require a new architecture revision and re-approval. Deferred OD promotion into scope requires explicit revision.

---

*End of Architecture Review and Approval.*
