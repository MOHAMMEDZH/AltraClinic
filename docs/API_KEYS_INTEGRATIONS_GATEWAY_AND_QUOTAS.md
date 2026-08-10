# API Keys & Integrations — Gateway & Quotas (Phase 44d)

**Phase:** 44d  
**Status:** Gateway & Quota Engine complete — **PRODUCTION ACCEPTED** · Release **44.0** (master flag default OFF)  
**Architecture SSOT:** [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)  
**Credential Engine:** [`API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md`](./API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md)  
**Webhook Engine:** [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md)

---

## Scope

Implements OD-AUTHN API-key gateway authentication and the Quota Engine:

- `Authorization: Bearer bk_|bki_…` (primary)
- `X-Api-Key: bk_|bki_…` (alternate)
- Hash verify (OD-HASH, constant-time)
- Status / expiry / revocation / rotation grace (OD-GRACE)
- Scope authorization (deny unknown / missing)
- License + feature-flag fail-closed
- In-process quota (sliding window + burst) — **OD-REDIS deferred**
- Usage accounting, Activity/Audit, metrics, diagnostics

**Does not implement:** Operations UI was Phase **44e** (complete — see operations UI doc); production enablement (44f), OAuth/PAT/mTLS, commercial billing, Redis-distributed quotas.

---

## Gateway architecture

```
Request
  → IntegrationsApiKeyAuthGuard (APP_GUARD, before JwtAuthGuard)
  → Extract Bearer or X-Api-Key
  → Reject if missing / invalid prefix (when API-key shaped)
  → Fail closed if flag OFF / license deny / pepper missing
  → Lookup by keyHash (global) + optional X-Tenant-Id hint
  → Constant-time hash verify
  → Reject revoked/expired; honor rotation grace
  → Authorize required scopes
  → Quota consume
  → Attach integrationsPrincipal; JwtAuthGuard skips
  → Handler
```

JWT Bearer tokens are **never** treated as API keys (OD-AUTHN).

---

## Authentication flow

1. Parse headers (`parseApiKeyFromHeaders`)
2. Require `API_KEYS_INTEGRATIONS_CENTER_ENABLED=true`
3. Require pepper (`API_CREDENTIAL_PEPPER_REF`)
4. `SHA-256(pepper ‖ raw)` → lookup `findByKeyHashGlobal`
5. `verifyApiCredentialHash` (timing-safe)
6. Tenant hint mismatch → deny
7. `isCredentialAuthnEligible` (active/expiring/rotated-in-grace)
8. License `allowIntegrations`
9. Service account must be active when owner is SA
10. Scope check via `CatalogScopeAuthorizer`
11. Quota consume
12. Update `lastUsedAt`

Principal fields: tenantId, credentialId, prefix, ownerType, ownerId, scopes, authSource, correlationId.

---

## Authorization model

- Required scopes via `@RequireApiKeyScopes(...)`
- Deny unknown scopes; no `*`
- Tenant isolation via credential tenant + optional `X-Tenant-Id`
- Admin diagnostics require `api.integrations:manage` (JWT owner path)

---

## Quota model

| Dimension | Default window |
|-----------|----------------|
| Per credential | 1000 / 3600s |
| Per tenant | 10000 / 3600s |
| Per service account | 5000 / 3600s |
| Per endpoint / operation | 600 / 60s |
| Burst | 50 tokens (token bucket) |

Backend: **in-process** (`InProcessQuotaEngine`). Documented single-node limit; Redis is OD-REDIS deferred.

Exceed → HTTP **429**, Activity `quota_exceeded`, Audit `integrations.quota.exceeded`, metric `integrations.quota.exceeded`.

---

## Usage accounting

Tracks per tenant:

- success / auth_failure / authorization_failure / quota_failure
- by credential, service account, endpoint
- recent event ring (no secrets)

---

## Security controls

- Constant-time hash compare
- Fail closed (flag / pepper / license)
- Credential redaction in logs
- Never log raw keys, hashes, Authorization headers, or signatures
- Tenant isolation
- JWT ≠ API key

---

## Admin APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/integrations/gateway/diagnostics` | manage |
| GET | `/integrations/gateway/quotas` | manage |
| POST | `/integrations/gateway/quotas/reset` | manage |
| POST | `/integrations/gateway/quotas/override` | manage |
| GET | `/integrations/gateway/usage` | manage |
| GET | `/integrations/gateway/whoami` | API-key + `ops.read` |
| POST | `/integrations/gateway/authenticate` | manage probe |

---

## Health

`phase: '44d'`, `authMiddleware.wired: true`, `gateway.wired: true`, `quotaEngine.wired: true`, `quotaBackend: in_process`, `redisDeferred: true`.

---

## Database

Migration `20260718180000_phase44d_gateway_quotas`:

- `integration_quota_policies`
- `integration_usage_counters`
- `integration_gateway_stats`
- unique index on `integration_api_credentials.keyHash`

Runtime quota/usage stores are in-memory by default (schema ready for durable swap).

---

## Performance

- Auth path: hash + single credential lookup + in-process quota maps
- Suitable for single-node; multi-instance requires OD-REDIS

---

## Tests

`gateway-quotas.spec.ts` — Bearer/X-Api-Key parsing, hash verify, revoke/expire/grace, scopes, flag/license denial, tenant mismatch, quota/burst/reset, service accounts, diagnostics.

---

## Deferred / known limitations

- Redis-backed distributed quotas (OD-REDIS)
- Prisma as Nest default DI for credentials/quotas
- DNS-level SSRF already owned by 44c webhooks (unchanged)

Operations UI: [`API_KEYS_INTEGRATIONS_OPERATIONS_UI.md`](./API_KEYS_INTEGRATIONS_OPERATIONS_UI.md).  
Acceptance: [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md).  
Release: [`RELEASE_44_0.md`](./RELEASE_44_0.md).
