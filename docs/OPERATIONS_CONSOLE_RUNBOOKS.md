# Operations Console Runbooks (Flexible Step 22)

Authority: `docs/OPERATIONS_CONSOLE.md`. Aggregation only — never invent engines.

**Status:** Accepted and complete (2026-08-10). Case C one-pass green on frozen `booking_test`. Step 23 unauthorized.

**Disk recovery:** Host `No space left on device` / `SQLITE_FULL` blocked migration wiring; disposable cleanup restored ~14 GB free. Do not drop `booking_test` or Docker volumes.

**Idempotency:** Provisioning retry = D-A Step 17 source + D-B ops pending claim before effect; cache invalidate = D-B `platform_operations_idempotency` (UI-CACHE-B API-only). Process Map is cache only.

**Integration health:** Config/enablement alone never implies HEALTHY.

**F24:** NOT APPLICABLE (no Step 22 rollback compensator). Hook containment proven separately (HOOK01–HOOK04).

## Shared rules

- Missing data ≠ HEALTHY
- Retry only via existing domain services
- Dangerous actions: permission + fresh step-up + reason + confirmation + idempotency + audit
- Never expose secrets, storage paths, raw payloads, PHI, SQL, stack traces

---

## Failed provisioning

| Field | Content |
|-------|---------|
| Symptoms | Status `FAILED_RETRYABLE`; Ops Console provisioning list shows retryable row |
| SoR | `PlatformTenantProvisioningRequest` + checkpoints |
| Safe diagnostics | Ops provisioning list; Audit Center by correlationId |
| Safe retry | Super Admin `/operations/provisioning` Retry UI **or** `POST /platform/operations/provisioning/:id/retry` → `TenantProvisioningService.retry` (D-A) + ops durable claim (D-B) |
| Retry prohibited | Non-retryable terminal states; missing step-up; OCC conflict |
| Permissions / step-up | `tenant.provision.retry` + fresh step-up + reason + Idempotency-Key |
| Audit | Exactly one success audit on first success; replay = 0 |
| Escalation | Platform engineering if source service unavailable |
| Forbidden | Direct status SQL updates; skip workflow steps |

## Failed Subscription expiry

| Field | Content |
|-------|---------|
| Symptoms | Commercial end approaching/past; **no expiry job failures** (job SoR DISABLED) |
| SoR | `PlatformSubscriptionCommercialConfig.commercialEnd` + licensing resolve |
| Safe diagnostics | Ops subscription-expiry list (read-only) |
| Safe retry | **None** — no expire worker to reprocess |
| Retry prohibited | Always (would invent commercial authority) |
| Escalation | Commercial ops / Plans & Subscriptions owners |
| Forbidden | Editing end dates / Plan assignment from Ops Console |

## Failed Override expiry

Same pattern as Subscription expiry: passive `expiresAt`; job SoR DISABLED; no Ops retry.

## Failed entitlement invalidation

| Field | Content |
|-------|---------|
| Symptoms | Stale EER cache indicators; UNKNOWN if runtime unwired |
| SoR | Process-local `EffectiveEntitlementCache` |
| Safe action | **API-only (UI-CACHE-B):** `POST /platform/operations/entitlement-cache/invalidate` — not exposed in Super Admin UI |
| Permissions | `operations.cache.invalidate` + fresh step-up + reason + confirmation `INVALIDATE` + Idempotency-Key |
| Durable authority | `platform_operations_idempotency` (D-B); process Map non-authoritative |
| Forbidden | Broad unscoped wipes; mutating entitlement snapshots; UI invalidate control |

## Compatibility-validation failure

| Field | Content |
|-------|---------|
| Symptoms | Catalog identity not 68/136/68/13 or DEGRADED card |
| SoR | Sync compatibility evaluator + catalog tables |
| Safe retry | **None** from Ops (no auto-fix) |
| Forbidden | Mutating Catalog/Plan/Add-on/Subscription from Ops |

## Unhealthy integration

| Field | Content |
|-------|---------|
| Symptoms | Integrations card UNKNOWN/UNHEALTHY/stale |
| SoR | Integrations health / ops dashboard |
| Safe retry | Webhook retry only when proven engine method wired |
| Forbidden | API keys, auth headers, raw webhook payloads |

## Stale operational status

| Field | Content |
|-------|---------|
| Symptoms | `STALE` badge; source timestamp aged past soft threshold |
| Action | Refresh read; investigate source hub; do not treat as FAILED |

## Backup failure visibility

| Field | Content |
|-------|---------|
| Symptoms | Backup list empty or failed metadata rows |
| SoR | Backup-Restore job manager metadata |
| Forbidden | Storage paths, signed URLs, restore workflow from Step 22 UI |

## Queue backlog

| Field | Content |
|-------|---------|
| Symptoms | Job list backlog / RETRYABLE rows |
| Forbidden | Arbitrary queue wipe / raw payload edit |

## Source adapter unavailable

| Field | Content |
|-------|---------|
| Symptoms | HTTP 503 `source_unavailable`; cards UNKNOWN |
| Action | Isolate unhealthy dependency; keep other adapters |
| Forbidden | Synthesizing HEALTHY placeholders |
