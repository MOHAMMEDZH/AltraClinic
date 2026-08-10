# API Keys & Integrations — Credential Engine (Phase 44b)

**Phase:** 44b  
**Status:** Credential Engine complete — **PRODUCTION ACCEPTED** · Release **44.0** (master flag default OFF) · Phases **44c–44e** complete  
**Architecture SSOT:** [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)  
**Foundation:** [`API_KEYS_INTEGRATIONS_FOUNDATION.md`](./API_KEYS_INTEGRATIONS_FOUNDATION.md)  
**Webhook Engine:** [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md)  
**Gateway & Quotas:** [`API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md`](./API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md)

---

## Scope

Implements the production-grade **Credential Engine** for tenant-scoped API credentials and service accounts:

- Issue / rotate / revoke / expire
- Service account create / disable
- Peppered SHA-256 hashing (OD-HASH)
- 24-hour rotation grace (OD-GRACE)
- Hash-only persistence (OD-SECRET-STORE for API keys)
- Legacy Settings dual-read / dual-write (OD-MIGRATE)
- Activity / Audit / notification intents / metrics

**Does not implement:** API-key auth middleware (44d), quotas, OAuth, PATs, full ops UI (44e).

---

## Aggregates

### ApiCredential

Fields: `id`, `tenantId`, `branchId`, `name`, `prefix`, `keyHash`, `hashAlgorithm`, `status`, `scopes`, `ownerType`, `ownerId`, `expiresAt`, `lastUsedAt`, `createdBy`, `rotatedFromId`, `rotationGraceEndsAt`, `createdAt`, `updatedAt`, `revokedAt`.

Statuses: `active` | `expiring` | `rotated` | `revoked` | `expired`.

Owner types: `user` | `service_account`.

### ServiceAccount

Fields: `id`, `tenantId`, `displayName`, `status`, `roleBindings`, `createdBy`, `createdAt`, `updatedAt`, `disabledAt`.

---

## Lifecycle state machine

| From | To |
|------|-----|
| active | expiring, rotated, revoked, expired |
| expiring | expired, revoked, rotated |
| rotated | revoked |
| revoked | _(terminal)_ |
| expired | _(terminal)_ |

Rotation: predecessor → `rotated` with `rotationGraceEndsAt` (+24h); successor → `active`. After grace, `expireApiCredentials` finalizes predecessor → `revoked`.

---

## Hashing & pepper

- Algorithm id: `sha256_pepper_v1`
- Formula: `SHA-256(pepper ‖ raw)`
- Pepper material from `API_CREDENTIAL_PEPPER_REF` (value or env indirection)
- Missing/short pepper → fail closed
- Verify: constant-time hex digest compare
- Entropy: ≥ 192 bits CSPRNG (`randomBytes(24)`)
- Prefixes: `bk_` (default), `bki_` (integration-bound)
- Public hint: first 12 characters of raw key

Raw material exists only in memory on issue/rotate response — never persisted, logged, audited, or snapshotted.

---

## Repository model

| Port | Implementations |
|------|-----------------|
| `ApiCredentialRepository` | In-memory (Nest default) · Prisma (`integration_api_credentials`) |
| `ServiceAccountRepository` | In-memory (Nest default) · Prisma (`integration_service_accounts`) |

Migration: `apps/api/prisma/migrations/20260718160000_phase44b_credential_engine/`.

Unique `(tenantId, keyHash)`. All queries tenant-scoped.

---

## Migration compatibility (OD-MIGRATE)

- **Dual-read:** `listCredentialMetadata` merges Center + Settings JSON when center enabled / legacy flag on.
- **Dual-write:** on Center issue/rotate, best-effort append to `features.developerSettings.apiKeys` with **legacy unpeppered** SHA-256 hash for Settings UI continuity.
- **Scope mapping:** legacy `read`/`write` → **`ops.read` only** — never PHI scopes.
- **Rollback:** `INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ=true`.
- Settings JSON **not removed**. Migration status: `dual_read` while center enabled; `complete` deferred.

---

## Security controls

- Fail closed: flag OFF, `allowIntegrations=false`, missing RBAC, missing pepper
- Deny unknown scopes / `*`
- High-risk scopes (`patients.write`, `billing.write`) require `approve` or `owner`
- No credential resurrection after revoke/expire
- Cross-tenant get/rotate/revoke → not found
- Redaction helper for `bk_` / `bki_` tokens
- Read APIs return metadata only (no `keyHash`)

---

## Observability

- Activity emitter: credential / service-account lifecycle (no secrets)
- Audit log: `integrations.credential.*` / `integrations.service_account.*`
- Notification intents recorded (not delivered): `credential_expiring`, `credential_revoked`, …
- Metrics counters: created / rotated / revoked
- Health: credential engine wired; auth middleware still unwired (44d)

---

## Thin admin APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/integrations/credentials` | view |
| POST | `/integrations/credentials` | create (returns `key` once) |
| POST | `/integrations/credentials/:id/rotate` | update |
| DELETE | `/integrations/credentials/:id` | delete |
| POST | `/integrations/credentials/ops/expire` | manage |
| POST | `/integrations/service-accounts` | create |
| POST | `/integrations/service-accounts/:id/disable` | manage |

---

## Tests

`credential-engine.spec.ts` covers issuance, one-time reveal, hashing, scopes, rotation grace, revoke, expire, service accounts, flag/license/RBAC denial, tenant isolation, redaction, legacy scope mapping, dual-write hook.

---

## Deferred (not 44b)

- Full Settings operations UI (44e)
- Migration status `complete` cutover
- Swap Nest DI to Prisma repositories in production deploy runbooks

Webhook Engine: [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md).  
Gateway & Quotas: [`API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md`](./API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md).

---

## Next

**Release 44.0** — [`RELEASE_44_0.md`](./RELEASE_44_0.md) · Acceptance: [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md).
