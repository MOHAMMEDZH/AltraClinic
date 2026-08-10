# Phase 44 — API Keys & Integrations Architecture

**Phase:** 44 (Architecture — **APPROVED AND FROZEN**)  
**Status:** **APPROVED AND FROZEN** · **PRODUCTION ACCEPTED** · **Release 44.0 READY** (flag default OFF) · **2026-07-18**  
**Master feature flag:** `API_KEYS_INTEGRATIONS_CENTER_ENABLED` — **default OFF** (enable only after enablement gate in Production Acceptance)
**Prerequisite:** Release **42.0** Import/Export **FROZEN**; Phase **43** Backup & Restore **Production Accepted** (Release **43.0** candidate, flag default OFF); Phase **41** Notification Center **FROZEN**; Dynamic Platform Phases **28–36**, **38–42** frozen as applicable; Phase **37** reserved  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Platform · Backend · Frontend · Security · Compliance · DevOps  
**SSOT for:** API Keys & Integrations Center (credential lifecycle, scopes, outbound/inbound integrations, webhooks, rate limits, ops hub)  
**Approval record:** [`PHASE_44_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_44_ARCHITECTURE_REVIEW_AND_APPROVAL.md)

**Numbering note:** A discovery brief labeled this capability “Phase 43.” Repository SSOTs **permanently assign Phase 43 to Backup & Restore**. **This architecture permanently assigns Phase 44 to the API Keys & Integrations Center.** Phase **37** remains reserved. Product roadmap taxonomies in `FEATURE_INVENTORY.md` do not override Dynamic Platform numbering.  

**Authority note:** This document is the **frozen** architectural SSOT for Phase 44. Discovery: [`PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md). Pre-existing Settings developer keys and Integrations settings are **foundation only** — not Phase 44 progress. Do **not** redesign Phases 1–43. Do **not** modify Phase 41 Notification Delivery Engine, Phase 42 Import/Export Runtime, or Phase 43 Backup & Restore engines. Critical open decisions are **resolved** below; deferred decisions must not expand 44a scope.

**Companion frozen SSOTs (consume, do not redesign):**  
[`NOTIFICATION_CENTER_ARCHITECTURE.md`](./NOTIFICATION_CENTER_ARCHITECTURE.md) · [`IMPORT_EXPORT_CENTER_ARCHITECTURE.md`](./IMPORT_EXPORT_CENTER_ARCHITECTURE.md) · [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md) · [`DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md`](./DYNAMIC_ACTIVITY_CENTER_ARCHITECTURE.md) · [`DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md`](./DYNAMIC_AUDIT_CENTER_ARCHITECTURE.md) · [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md`](./DYNAMIC_MODULE_MANAGEMENT_ARCHITECTURE.md) · [`BACKGROUND-ARCHITECTURE.md`](./BACKGROUND-ARCHITECTURE.md)

**Discovery companion:** [`PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md)

---

## 1. Executive Summary

The **API Keys & Integrations Center** is the clinic’s **governed connectivity control plane**: a licensed, RBAC-gated, tenant-aware orchestrator for **machine credentials**, **permission scopes**, **third-party integration registrations**, and **webhook subscriptions** (outbound delivery and inbound reception).

It turns today’s Settings-embedded key CRUD and weak webhook test into an **enterprise-grade** platform with:

- Secure key generation, **hash-at-rest**, rotation, expiry, and revocation  
- Enforceable **scopes** at the API gateway  
- **Service accounts** (machine principals)  
- Outbound integration catalogs and signed webhook delivery with retry/DLQ  
- Inbound webhook receivers with signature verification  
- Rate limiting, throttling, and licensing quotas  
- Full Activity / Audit / Notification-intent / Health / Metrics coverage  

**Non-goals:** Replacing Notification Delivery; owning OAuth IdP for human login; becoming clinical SoR; redesigning Backup/Import/Export; shipping PATs or OAuth client registry in Phase 44a–44e.

---

## 2. Goals

### 2.1 Business goals

- Enable safe partner and automation access without sharing staff passwords.  
- Reduce support incidents from leaked or over-privileged keys.  
- Provide a single Integrations hub for operators and technical admins.  
- Support accounting, calendar, LIS-lite, payment, and custom HTTP integrations under governance.

### 2.2 Healthcare / compliance goals

- PHI never stored in credential secrets or webhook debug bodies beyond policy.  
- Least-privilege scopes; deny-by-default.  
- Every create / rotate / revoke / anomalous use is **audited**.  
- Tenant isolation on all credentials and subscriptions.  
- Fail closed when license, flag, or permission missing.

### 2.3 Operational goals

- Predictable credential lifecycle with operator UX (create once reveal, rotate, revoke).  
- Debuggable webhook deliveries without exposing secrets.  
- Clear SLAs for outbound webhook attempts and DLQ handling.  
- Compatibility path from Settings developer keys.

### 2.4 Problems solved

| Problem | Center response |
|---------|-----------------|
| Keys stored in Tenant JSON with unused hashes | First-class credential aggregate + auth middleware |
| Scopes not enforced | Scope catalog + gateway checks |
| Webhook test without SSRF/HMAC | Reuse Notification SSRF/HMAC patterns for tenant webhooks |
| No rotation / expiry | Policy engine |
| No rate limits per key | Quota service |
| Fragmented “integrations” UI | Settings hub under Integrations Center |

### 2.5 Problems explicitly NOT solved

| Non-goal | Owner |
|----------|--------|
| Human OIDC/SSO for clinic staff login | Auth module (existing) |
| Notification quiet hours / consent / channel adapters redesign | Phase 41 |
| Full FHIR/HIE mesh | Future interoperability program |
| Backup artifact access via raw keys without BR RBAC | Phase 43 BR remains SoR for DR |
| APM / distributed tracing product | Phase 45 candidate |
| Marketplace plugin signing PKI | Plugin SDK future |

---

## 3. Scope

### 3.1 In scope (architecture + future authorized implementation)

1. Credential catalog and lifecycle (API keys; service accounts). **PATs are out of Phase 44a–44e scope** (see OD-PAT deferred).  
2. Secure generation, hashing with pepper, rotation, expiry, revocation.  
3. Scope / permission catalog mapped to RBAC resource actions — **deny-by-default**.  
4. API-key authentication middleware for selected public/partner APIs (Phase **44d**; contracts reserved in 44a).  
5. Outbound integration registrations (provider kind, config refs, encrypted secret refs).  
6. Outbound webhook subscriptions (events, URLs, secrets, filters) — Phase **44c**.  
7. Inbound webhook endpoints — Phase **44c**.  
8. Webhook security: HTTPS, SSRF guard, HMAC signatures, timestamp skew, replay window.  
9. Retry, backoff, dead-letter for outbound webhook jobs on queue **`integrations-webhooks`**.  
10. Rate limiting, throttling, quotas (per key, per tenant, per license tier) — Phase **44d**.  
11. Licensing + feature flags (`API_KEYS_INTEGRATIONS_CENTER_ENABLED` default **false**).  
12. Activity, Audit, Notification intents (contracts in 44a; emitters in later sub-phases).  
13. Health, metrics, structured logs, correlation IDs.  
14. Operations UI (Settings hub) — Phase **44e**.  
15. Migration/compatibility from Settings `developerSettings.apiKeys` — dual-read/dual-write (OD-MIGRATE); execution in **44b**.  
16. Dynamic Platform extension kind **`integrations`** (local registration).  
17. EffectiveIntegrationsView read model.

### 3.2 Out of scope

- Redesign of Phases 41–43.  
- Owning domain SoRs.  
- Storing third-party OAuth refresh tokens in plaintext.  
- Client-side secret generation authority.  
- Using notification channel adapters as the long-term SoR for integration webhooks (may **reuse libraries/patterns** only).  
- Automatic enablement of `API_KEYS_INTEGRATIONS_CENTER_ENABLED` in production.

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Ops UI (Settings → API Keys & Integrations)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ API Keys & Integrations Center (Nest module)                     │
│  Credential Engine │ Scope Catalog │ Integration Registry         │
│  Webhook Orchestrator │ Quota / Rate Limit │ Effective View       │
└───────┬───────────────┬──────────────────┬──────────────────────┘
        │               │                  │
   ┌────▼────┐   ┌──────▼──────┐   ┌───────▼────────┐
   │ AuthN   │   │ Outbound    │   │ Inbound HTTP   │
   │ Guard   │   │ Webhook     │   │ Receivers      │
   │ (API    │   │ Workers*    │   │ (signed)       │
   │  key)   │   │             │   │                │
   └────┬────┘   └──────┬──────┘   └───────┬────────┘
        │               │                  │
        ▼               ▼                  ▼
   Domain APIs    Partner URLs        Partner systems
   (scoped)       (SSRF-safe)

* Workers: dedicated BullMQ queue **`integrations-webhooks`** (OD-QUEUE). Phase **44a** reserves the name only — **does not wire** consumers. Must never share Notification / IE / BR queues.
```

**Runtime principle:** Fail closed. Secrets never logged. Raw key material shown **once** at creation/rotation.

---

## 5. Bounded Contexts

| Context | Responsibility | Relationship |
|---------|----------------|--------------|
| **Integrations Center** | Credentials, scopes, integration registrations, webhook subscriptions, quotas | Owns |
| **Auth** | Human JWT/MFA; shares auth pipeline hooks for API-key strategy | Consumes / extends carefully |
| **RBAC** | Matrix actions | Consumes |
| **Licensing** | SKU / tenant gates | Consumes |
| **Notification Delivery** | Channel webhook adapter for notifications | Boundary: patterns only |
| **Activity / Audit** | Observe / prove | Consumes |
| **Workflow** | May emit events / call webhooks | Must use Center credentials when authorized |
| **Domain modules** | Business APIs protected by scopes | Remain SoRs |

---

## 6. Domain Design

### 6.1 Aggregate roots (proposed)

| Aggregate | Invariants |
|-----------|------------|
| **ApiCredential** | Belongs to one tenant; secret hash immutable until rotation; status machine enforced; scopes ⊆ catalog |
| **ServiceAccount** | Machine principal; may own multiple credentials; cannot login interactively |
| **IntegrationRegistration** | Provider kind + config; secrets by reference; tenant-bound |
| **WebhookSubscription** | URL HTTPS; secret hashed/encrypted; event filters valid; enabled only if license+flag |
| **InboundWebhookEndpoint** | Path unique per tenant+provider; signature policy required |
| **ScopeDefinition** | Stable id; maps to RBAC actions; versioned |
| **QuotaPolicy** | Tenant/key limits; non-negative |

### 6.2 Entities

- `ApiCredential` — id, tenantId, name, prefix, keyHash, algorithm, status, scopes, ownerType (`user` \| `service_account`), ownerId, expiresAt, lastUsedAt, createdBy, rotatedFromId  
- `ServiceAccount` — id, tenantId, displayName, status, roleBindings  
- `IntegrationRegistration` — id, tenantId, providerKey, displayName, status, configRef, secretRef  
- `WebhookSubscription` — id, tenantId, integrationId?, url, secretHash, events[], status, retryPolicyId  
- `WebhookDeliveryAttempt` — id, subscriptionId, eventId, status, attempt, responseCode, nextRetryAt, deadLetteredAt  
- `InboundWebhookReceipt` — id, endpointId, signatureValid, processedAt, correlationId  
- `PersonalAccessToken` — **out of Phase 44 scope** (OD-PAT deferred); do not model in 44a–44e

### 6.3 Value objects

- `ApiKeyPrefix` — public hint (`bk_xxxxxxxxxxxx`)  
- `ScopedPermissionSet` — frozen set of scope ids  
- `CredentialStatus` — `active` \| `expiring` \| `rotated` \| `revoked` \| `expired`  
- `WebhookSignatureScheme` — `hmac_sha256_v1` (align with Notification headers)  
- `RateLimitWindow` — `{ limit, windowSeconds }`  
- `SecretReference` — vault/env/kms pointer (never raw in VO logs)  
- `TenantScopedId` — tenant + id  
- `CorrelationContext` — correlationId / causationId  

### 6.4 Domain services

- `CredentialIssuer` — generate raw + hash; enforce entropy  
- `CredentialAuthenticator` — constant-time hash compare; update lastUsed  
- `ScopeAuthorizer` — scope ⊆ required  
- `RotationService` — dual-key grace window  
- `WebhookSigner` / `WebhookVerifier` — HMAC + timestamp skew  
- `SsrfGuard` — reuse Notification evaluation rules  
- `QuotaEvaluator` — allow/deny + remaining  

### 6.5 Repository contracts (ports)

- `ApiCredentialRepository`  
- `ServiceAccountRepository`  
- `IntegrationRegistrationRepository`  
- `WebhookSubscriptionRepository`  
- `WebhookDeliveryAttemptRepository`  
- `InboundWebhookEndpointRepository`  
- `ScopeCatalogRepository` (or static catalog + DB overrides)  
- `QuotaPolicyRepository`  

No Prisma access from UI; application services only.

---

## 7. API Key Lifecycle

```
requested → generated (raw once) → active
                ↓
         rotate → grace (old+new) → active (new) / revoked (old)
                ↓
         expire → expired
                ↓
         revoke → revoked (terminal)
```

| Stage | Rules |
|-------|-------|
| Generate | CSPRNG ≥ 192 bits; prefix `bk_` (user/service key) or `bki_` (integration-bound); raw returned **once**; store **SHA-256(pepper \|\| raw)** only |
| Activate | Requires license + flag + RBAC |
| Use | Auth middleware validates hash (constant-time), status, expiry, scopes (deny unknown), quota |
| Rotate | New credential; **24h grace** (OD-GRACE) where old+new both valid; then old → `revoked` |
| Expire | Request-time check on `expiresAt`; status → `expired` |
| Revoke | Immediate; audit; optional Notification intent |

---

## 8. Key Generation Strategy

| Property | Requirement |
|----------|-------------|
| Entropy | **≥ 192 bits** CSPRNG (24+ bytes); compatible with current `bk_` + 24-byte hex foundation |
| Format | Prefixed `bk_` or `bki_` for detection/redaction in logs |
| Prefix | First 12 characters stored plaintext for UI identification |
| Hash (OD-HASH) | `SHA-256( pepper \|\| rawKey )` where `pepper = process.env[API_CREDENTIAL_PEPPER_REF]` material |
| Verify | **Constant-time** compare of digests |
| Persist | Hash + prefix + metadata **only** — never raw |

**Never** store raw key. **Never** log raw key. UI one-time reveal only on create/rotate response body (not in Activity/Audit payloads).

---

## 9. Secure Storage Strategy

| Data | Storage (frozen) |
|------|------------------|
| API key material | **Hash-only** (OD-HASH); never recoverable |
| Prefix / metadata | DB; non-secret |
| Webhook signing secrets | **AES-256-GCM envelope** at rest via `INTEGRATIONS_SECRET_KEY_REF` (OD-SECRET-STORE); plaintext only in memory at sign time |
| Third-party client secrets | Same envelope encryption or external SecretReference — **never plaintext columns** |
| Legacy Settings JSON keys | Dual-read until migration complete; then Center SoR |

**Tenant JSON `features.developerSettings.apiKeys` is deprecated as SoR** after 44b migration completes.

---

## 10. Hashing & Encryption

| Concern | Frozen approach |
|---------|-----------------|
| API key verify | SHA-256 with server-side pepper + constant-time compare (high-entropy secrets; Argon2 rejected for request-path latency) |
| Pepper custody | Env/KMS name in `API_CREDENTIAL_PEPPER_REF`; missing pepper → Center **not ready** (fail closed) |
| Webhook secrets | Envelope encrypt (AES-256-GCM); decrypt to sign outbound HMAC |
| TLS | Required for all outbound; reject non-HTTPS URLs |
| HMAC wire format | Align with Notification: `X-Booking-Signature` = HMAC-SHA256(secret, `timestamp.body`); `X-Booking-Timestamp` unix seconds; skew ≤ **300s** |

---

## 11. Rotation, Expiration, Revocation

| Policy | Frozen rule |
|--------|-------------|
| Rotation | Operator-initiated (44b); create successor; **24-hour grace** where predecessor remains valid (OD-GRACE) |
| Expiration | Optional `expiresAt`; enforced on every authn |
| Revocation | Immediate status `revoked`; no grace |
| Mass revoke | Tenant lockdown / break-glass — audited |

---

## 12. Scopes & Permissions

### 12.1 Scope catalog (initial proposed set)

| Scope id | Meaning | Maps toward |
|----------|---------|-------------|
| `ops.read` | Read non-PHI ops metadata | view |
| `patients.read` | Read patient APIs | patients view |
| `patients.write` | Mutate patients | patients create/update |
| `scheduling.read` / `.write` | Appointments | scheduling |
| `billing.read` / `.write` | Invoices | billing |
| `import_export.run` | Trigger IE jobs | api.importExport |
| `backup.read` | List snapshots metadata | api.backupRestore view |
| `webhooks.manage` | Manage subscriptions | integrations manage |
| `*` | Forbidden in v1 | — |

Exact matrix binding is an implementation task in **44b/44d**; **deny unknown scopes**; **no `*` scope**.

**High-risk scopes** (`patients.write`, `billing.write`, and any future PHI-mutating scopes): assignment requires `api.integrations` action **`approve`** or role `owner` (OD-DUAL full two-person workflow deferred — see Decision Register).

### 12.2 RBAC (hub UI / admin APIs)

Resource: **`api.integrations`** (frozen name)

| Action | Use |
|--------|-----|
| `view` | List keys (prefixes), subscriptions, health |
| `create` | Create credentials / subscriptions |
| `update` | Rotate, edit filters |
| `delete` | Revoke / remove |
| `manage` | Quotas, break-glass, inbound endpoints |
| `approve` | Assign high-risk scopes |

---

## 13. Tenant Isolation

- Every aggregate carries `tenantId` — **mandatory**.  
- Auth middleware binds credential → tenant; rejects cross-tenant use.  
- No cross-tenant webhook delivery.  
- Inbound receivers resolve tenant from path claim + signature, never from untrusted body alone.  
- **Branch restriction:** schema may include optional `branchId`; **enforcement deferred** (OD-BRANCH) — v1 is tenant-scoped only.

---

## 14. Service Accounts & PATs

| Type | Purpose | Phase 44 stance |
|------|---------|-----------------|
| **Service Account** | Non-human principal for integrations | **In scope** (44b+) |
| **User-owned API Key** | Automation under a user | **In scope** (compat with Settings) |
| **Personal Access Token** | User PAT UX | **Deferred** (OD-PAT) — not in 44a–44e |

Service accounts must not receive interactive session cookies; only credentials.

---

## 15. Third-Party / Outbound / Inbound Integrations

### 15.1 Outbound

- Catalog of `providerKey`s (payment, accounting, calendar, custom.http, …).  
- Registration holds non-secret config + SecretReference.  
- Domain adapters call Integration Gateway with credential id — never raw secrets in domain code.

### 15.2 Inbound

- Dedicated routes under `/integrations/hooks/:tenantSlug/:provider` (shape TBD).  
- Verify signature → emit domain event / command → receipt.  
- Idempotency keys required.

### 15.3 Boundary with Notification webhooks

| | Notification (41) | Integrations (44) |
|--|-------------------|-------------------|
| Purpose | Deliver user notifications | System/integration events |
| Secret | `WEBHOOK_SIGNING_SECRET` / metadata | Per-subscription secret |
| Owner | Delivery engine | Integrations Center |
| Freeze | Do not modify engine | New module |

Shared: SSRF guard function, HMAC header naming conventions where possible (`X-Booking-Signature`, `X-Booking-Timestamp`).

---

## 16. Webhook Architecture

### 16.1 Outbound pipeline (conceptual)

```
Domain/Activity event → Integration Event Bus filter
  → WebhookSubscription match → enqueue delivery job
  → sign + POST → record attempt → retry / DLQ
```

### 16.2 Security

- HTTPS only; SSRF deny private/link-local/metadata (reuse `evaluateWebhookUrlSafety`).  
- HMAC-SHA256 over `timestamp.body`.  
- Reject skew > N seconds (e.g. 300).  
- Optional mTLS later (OD-MTLS).

### 16.3 Retry & DLQ

| Class | Behavior |
|-------|----------|
| Retryable (5xx, timeout) | Exponential backoff; max attempts |
| Permanent (4xx except 429) | Fail; no retry storm |
| 429 | Honor Retry-After when present |
| Exhausted | Dead-letter + Activity + Audit + Notification intent |

### 16.4 Queue ownership (frozen — OD-QUEUE)

| Rule | Value |
|------|-------|
| Queue name | **`integrations-webhooks`** |
| Technology | BullMQ (same platform pattern as Notification/IE) |
| Isolation | **Never** reuse `notification-delivery`, `import-export`, or `backup-restore` |
| Phase 44a | Register queue **name** + health `wired: false` only |
| Phase 44c | Wire producers/consumers |

Sync-only delivery is allowed **only** for operator “Test webhook” in UI (bounded timeout), not for production event fan-out.

---

## 17. Rate Limiting, Throttling, Quotas

| Layer | Mechanism |
|-------|-----------|
| Per API key | Token bucket / sliding window |
| Per tenant | Aggregate cap from license |
| Per IP (inbound hooks) | Edge / middleware limit |
| Admin UI | Standard auth rate limits |

Exceed → `429` + Audit anomaly (sampled) + metric.

Licensing example capabilities: `integrationsBasic`, `integrationsAdvanced`, `webhookOutbound`, `highQuota`.

---

## 18. Platform Integrations (consume only)

| Platform | Usage |
|----------|-------|
| Feature Flags | Master `API_KEYS_INTEGRATIONS_CENTER_ENABLED` (default false); sub-flags for webhooks / inbound / service accounts |
| Licensing | Tenant gate (extend `integrations` subscription feature) |
| Activity | Credential created/rotated/revoked; webhook delivered/failed; quota exceeded |
| Audit | Same + auth failures (careful PHI) |
| Notification | Intents only: `credential_expiring`, `webhook_dead_letter`, `credential_revoked` |
| Health | Center readiness, secret store configured, queue wired, migration status |
| Observability | Metrics namespace `integrations`; correlation IDs on all jobs |

---

## 19. Security Architecture & Threat Model

### 19.1 Assets

Raw API keys, webhook secrets, integration tokens, scope grants, tenant data accessible via scopes.

### 19.2 Threats & mitigations

| Threat | Mitigation |
|--------|------------|
| Key theft from DB | Hash at rest; pepper; no raw |
| Key theft from logs | Redaction filters; structured log policy |
| Privilege escalation via `*` scope | Disallow; review high scopes; OD-DUAL |
| SSRF via webhook URL | SSRF guard |
| Replay of webhooks | Timestamp + signature |
| Cross-tenant key use | Tenant bind on auth |
| Brute force hashes | High entropy keys; rate limit auth endpoint |
| Insider misuse | Audit + least privilege UI RBAC |

### 19.3 Failure scenarios & recovery

| Failure | Recovery |
|---------|----------|
| Pepper/KMS loss | Break-glass rotate all credentials; documented runbook (later) |
| Queue down | Health not-ready; buffer or reject with 503 |
| Partner endpoint down | Retry/DLQ; operator replay |
| Migration dual-write drift | Reconciliation job; prefer Center SoR |

---

## 20. Extension Points & Plugin Architecture

- **Scope pack** marketplace later (not v1).  
- **Provider adapters** for inbound (Stripe-like, custom HMAC).  
- Extension kind `integrations` registered locally (Module Registry unchanged until approved pack).  
- Static catalog baseline non-authoritative (same pattern as IE/BR).

---

## 21. UI Architecture

Settings group **Advanced / Operations** (alongside Integrations & Developer):

| Route (proposed) | Purpose |
|------------------|---------|
| `/settings/api-integrations` | Overview / health |
| `.../credentials` | API keys & service accounts |
| `.../credentials/new` | Create + one-time reveal |
| `.../webhooks` | Subscriptions + delivery history |
| `.../inbound` | Inbound endpoints |
| `.../catalog` | Scopes & providers |
| `.../health` | Readiness |

**Rules:** No secrets in client storage beyond one-time reveal UX; RBAC hide actions; license upgrade messaging; a11y parity with IE/BR hubs; FeatureGate + master flag.

Developer Settings page becomes **compatibility entry** linking to Center after enablement.

---

## 22. Administration & Operational Workflows

1. **Create key** → select scopes → confirm → reveal once → store hash.  
2. **Rotate** → issue new → communicate grace → revoke old.  
3. **Revoke** → immediate.  
4. **Register webhook** → URL validate SSRF → secret → event filters → test delivery.  
5. **Debug DLQ** → inspect (redacted) → replay.  
6. **Inbound setup** → provision endpoint + share signing secret to partner.

---

## 23. Deployment Considerations

- Flag default **OFF**.  
- Secrets: `API_CREDENTIAL_PEPPER_REF` + `INTEGRATIONS_SECRET_KEY_REF`.  
- Migrate Settings keys (OD-MIGRATE) before forcing flag ON in any environment.  
- Rate limits: in-process limiter acceptable for single-node until OD-REDIS adopted; document limit.  
- Do not enable inbound hooks without public TLS termination.

---

## 24. Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Hashing, scope authz, state machine, SSRF, HMAC verify |
| Integration | Credential CRUD, auth middleware, webhook retry/DLQ |
| Security | Cross-tenant, revoked key, expired key, scope denial |
| E2E / a11y | Hub smoke + axe region |
| Load | Auth + webhook fan-out (non-prod) |

---

## 25. Production Readiness Requirements (future 44f)

- All gates G1–G10 style (flag, license, RBAC, audit, health, drill of rotate/revoke, webhook DLQ demo).  
- Migration complete or dual-read verified.  
- No plaintext secrets in DB.  
- Runbooks for revoke storm and pepper rotation (ops docs phase).  

---

## 26. Component Breakdown (logical modules)

| Component | Responsibility |
|-----------|----------------|
| `integrations` Nest module | Composition root |
| Credential Engine | Lifecycle |
| Scope Catalog | Definitions + Effective view |
| Auth Middleware | API-key strategy |
| Integration Registry | Provider registrations |
| Webhook Orchestrator | Outbound/inbound |
| Quota Service | Limits |
| Ops Controllers | Thin HTTP |
| Ops UI feature | clinic-dashboard |

---

## 27. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Numbering confusion with Phase 43 | Permanent Phase **44** in all docs |
| R2 | Scope creep into OAuth IdP | OD-OAUTH defer |
| R3 | Duplicate webhook stacks vs Phase 41 | Strict boundary table |
| R4 | Settings JSON migration | Compatibility window |
| R5 | Rate limit store not distributed | Document; OD-REDIS |
| R6 | Over-broad scopes | Catalog review; dual-control OD |

---

## 28. Assumptions

- Backup & Restore and Import/Export remain frozen/consumed.  
- Notification Delivery remains frozen; SSRF/HMAC **patterns** may be shared via extracted util or careful duplication — **no delivery engine redesign**.  
- Clinics accept one-time key reveal UX.  
- Phase 44a–44e ship **without** PATs and **without** OAuth client registry.  
- Master flag remains **OFF** by default through Production Acceptance.

---

## 29. Decision Register (Architecture Freeze)

### 29.1 Critical decisions — RESOLVED

#### OD-HASH — RESOLVED

| | |
|--|--|
| **Selected** | `SHA-256(pepper \|\| rawKey)` with **constant-time** digest compare |
| **Pepper** | Material from env named by `API_CREDENTIAL_PEPPER_REF`; missing → health not ready / fail closed |
| **Rationale** | API keys are high-entropy; slow hashes (Argon2) add latency on every authenticated request without proportional benefit |
| **Security** | Pepper defeats offline attacks on stolen hash tables; raw never stored |
| **Rejected** | Plain SHA-256 without pepper; Argon2id/bcrypt for request-path verify |
| **Constraints** | Algorithm id `sha256_pepper_v1` stored on credential for future upgrade |

#### OD-GRACE — RESOLVED

| | |
|--|--|
| **Selected** | **24 hours** rotation grace (old + new both `active` for authn) |
| **Rationale** | Enough for partner config roll; short enough for healthcare exposure |
| **Rejected** | 0h (breaks rolling updates); 72h (excessive exposure) |
| **Constraints** | Revocation remains immediate (no grace); grace only for rotation succession |

#### OD-QUEUE — RESOLVED

| | |
|--|--|
| **Selected** | Dedicated BullMQ queue **`integrations-webhooks`** |
| **Rationale** | Isolates load/failures from Notification, Import/Export, and Backup; matches enterprise hub pattern |
| **Rejected** | Reusing `notification-delivery` / `import-export` / `backup-restore`; Background generic as SoR |
| **Constraints** | 44a: name reserved, `wired: false`. 44c: wire workers. Test-dispatch may be sync with timeout |

#### OD-SECRET-STORE — RESOLVED

| | |
|--|--|
| **Selected** | API keys = **hash-only**. Recoverable secrets (webhook signing, third-party client secrets) = **AES-256-GCM envelope** using key material from `INTEGRATIONS_SECRET_KEY_REF` |
| **Rationale** | Outbound HMAC requires recoverable signing secret; API keys must never be recoverable |
| **Rejected** | Plaintext DB columns; hash-only for webhook secrets (cannot sign); relying on Phase 41 `WEBHOOK_SIGNING_SECRET` as tenant SoR |
| **Constraints** | No plaintext secret persistence; decrypt only in memory at use; missing key ref → not ready |

#### OD-MIGRATE — RESOLVED

| | |
|--|--|
| **Selected** | **Dual-read / dual-write** with reconciliation; Center becomes SoR when migration flag complete |
| **Scope mapping** | Legacy Settings scopes `read`/`write` import as **`ops.read` only** — **never** auto-grant `patients.*` / `billing.*` / other PHI scopes |
| **Rationale** | Preserve ability to authenticate migrated keys without silently escalating privilege (keys were not gateway-enforced before) |
| **Rollback** | Feature sub-flag `INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ=true` re-enables Settings JSON read path |
| **Rejected** | Big-bang cutover; copying legacy `write` → domain write scopes |
| **Constraints** | Operator must explicitly re-scope for broader access; Audit every import; reconciliation job lists drift |

#### OD-AUTHN — RESOLVED

| | |
|--|--|
| **Selected** | Primary: `Authorization: Bearer <rawApiKey>` where key has prefix `bk_` / `bki_`. Alternate: `X-Api-Key: <rawApiKey>` |
| **Rationale** | Bearer is standard for machine clients; `X-Api-Key` supports common integrator tooling; prefix distinguishes from JWT |
| **Rejected** | JWT-only; undocumented custom schemes; accepting unprefixed secrets |
| **Constraints** | Middleware must not treat JWT as API key; API-key routes fail closed if flag/license/pepper missing |

### 29.2 Non-critical decisions — classification

| ID | Classification | Boundary |
|----|----------------|----------|
| **OD-PAT** | **DEFERRED WITH EXPLICIT BOUNDARY** | No PAT entity, API, or UI in 44a–44e. User-owned API keys cover automation. Reopen only in a later phase. |
| **OD-OAUTH** | **DEFERRED WITH EXPLICIT BOUNDARY** | No OAuth/OIDC client registry in Phase 44. Human SSO remains Auth module. |
| **OD-DUAL** | **DEFERRED WITH EXPLICIT BOUNDARY** | Two-person approval workflow deferred. **Resolved minimum:** assigning high-risk scopes requires `approve` or `owner`. |
| **OD-BRANCH** | **DEFERRED WITH EXPLICIT BOUNDARY** | Optional `branchId` column allowed; **enforcement not required** until a later sub-phase. v1 = tenant-scoped. |
| **OD-REDIS** | **DEFERRED WITH EXPLICIT BOUNDARY** | 44d may ship in-process rate limiter (document single-node). Redis adoption is ops enhancement, not 44a blocker. |
| **OD-MTLS** | **DEFERRED WITH EXPLICIT BOUNDARY** | Outbound mTLS not in Phase 44. HTTPS + HMAC required. |

**No BLOCKING decisions remain.**

---

## 30. API-key authentication pipeline (frozen)

```
Request
  → Extract Bearer or X-Api-Key
  → Reject if missing / not bk_|bki_ prefix
  → Fail closed if flag OFF or license deny or pepper missing
  → Lookup by hash+tenant (constant-time verify)
  → Reject revoked/expired; honor rotation grace
  → Authorize required scopes (deny unknown / missing)
  → Quota check
  → Attach principal (service account or user) to request context
  → Domain handler
```

---

## 31. EffectiveIntegrationsView (44a contract)

Read model fields (minimum):

- `featureEnabled`, `allowIntegrations` (license), `visible`
- `credentialCounts` (by status; **no secrets**)
- `scopeCatalog` (ids + descriptions; non-executable until 44d)
- `webhookSubscriptionCounts`, `queueWired`, `secretStoreReady`, `pepperReady`
- `migrationStatus`: `not_started` \| `dual_read` \| `complete`
- `meta`: catalog counts, executable adapters = 0 in 44a

Static provider catalog is **never** runtime authority (same pattern as IE/BR).

---

## 32. Future Implementation Roadmap

| Sub-phase | Deliverable | Entry prerequisite | Forbidden |
|-----------|-------------|--------------------|-----------|
| **44a Foundation** | Module, flags, RBAC resource, licensing contracts, EffectiveIntegrationsView, health, null/ports, queue **name** reserved | Architecture **APPROVED** (this freeze) | Auth middleware, workers, migrations of live secrets, UI execution |
| **44b Credential Engine** | Issue/rotate/revoke/hash; OD-MIGRATE dual-read; Activity/Audit | 44a complete | Webhook workers |
| **44c Webhooks & Integrations** | Subscriptions, outbound on `integrations-webhooks`, inbound receivers, retry/DLQ | 44b complete | OAuth mesh; Notification engine edits |
| **44d Gateway & Quotas** | API-key auth middleware, rate limits | 44b complete (44c recommended) | APM product |
| **44e Operations UI** | Settings hub, one-time reveal UX, a11y | 44b minimum | Design-system rewrite |
| **44f Production Acceptance** | Gates; flag remains default OFF | 44a–44e complete | Scope expansion |

---

## 33. Phase 44a — Entry and Exit Criteria

### Entry (all required)

1. This SSOT status = **APPROVED AND FROZEN**.  
2. Approval record published.  
3. Critical ODs resolved (HASH, GRACE, QUEUE, SECRET-STORE, MIGRATE, AUTHN).  
4. No production business logic yet for 44b+ until authorized kickoff.  
5. Phases 41–43 remain unmodified.

### Exit (44a done when)

1. Nest module registered; DI ports/null holders present.  
2. `API_KEYS_INTEGRATIONS_CENTER_ENABLED` (default false) + documented sub-flags.  
3. RBAC resource `api.integrations` registered in matrix vocabulary (actions as above).  
4. Licensing gate contract (`integrations` / `allowIntegrations`) documented and consumed as **false-closed**.  
5. `EffectiveIntegrationsView` returns dormant empty/visible=false when flag off.  
6. Health exposes: featureFlag, pepperReady (false if unset), secretStoreReady, queue name `integrations-webhooks`, `wired: false`, worker/scheduler unwired, phase `44a`.  
7. Activity/Audit/Notification **contracts only** (no delivery).  
8. **No** API-key auth enforcement, **no** BullMQ consumers, **no** secret migration writes unless explicitly dual-write stubs behind flag.  
9. Tests: foundation/health/flag/RBAC contracts only.  
10. Docs: foundation guide for 44a.

---

## 34. Document Control

| Field | Value |
|-------|-------|
| Status | **APPROVED AND FROZEN** |
| Approval date | **2026-07-18** |
| Implementation | **Phase 44a–44f COMPLETE** · **PRODUCTION ACCEPTED** · **Release 44.0 READY** |
| Phase number | **44** (API Keys & Integrations) |
| Phase 43 | Remains Backup & Restore (complete / frozen engines) |
| Feature flag default | **OFF** |
| Acceptance | [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md) · [`RELEASE_44_0.md`](./RELEASE_44_0.md) |

**Freeze rule:** Critical-path ambiguity is closed. Deferred ODs must not expand 44a. Changes to frozen decisions require a new architecture revision + re-approval.

---

*End of Architecture SSOT (APPROVED AND FROZEN).*
