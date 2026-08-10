# Operations Console (Flexible Step 22)

Aggregation console over existing Systems of Record. Never invent engines, expire workers, restore workflows, shell, or SQL.

**Status:** Accepted and complete (2026-08-10). Narrow final correction gate Case C one-pass green. Step 23 unauthorized.

## Disk-full root cause (correction gate)

Host exhausted free space during the prior narrow correction (`No space left on device`, Cursor `SQLITE_FULL`, write failures). Product edits and migration application were interrupted. Safe cleanup of disposable Cursor/repo TEMP/caches restored writable disk (~14 GB free before product resume; ~13 GB before final Case C). Preserved: `booking_test`, Docker volumes, `.git`, migrations, schema, source, accepted docs, fixtures, durable Step 21/22 records.

## Schema / migration / DB

| Item | State |
|------|--------|
| Model | `PlatformOperationsIdempotencyRecord` → `platform_operations_idempotency` in `schema.prisma` |
| Migration | `apps/api/prisma/migrations/20260809180000_phase47_step22_operations_idempotency/migration.sql` |
| Classification | **S-D** — DB table present, `_prisma_migrations` finished for this migration |
| Authority | Do not create a duplicate migration |

## Action idempotency inventory

| Action | Durable authority | Process Map | Fingerprint inputs | Replay / conflict | Restart / multi-instance | Audit cardinality |
|--------|-------------------|-------------|--------------------|-------------------|--------------------------|-------------------|
| `POST .../provisioning/:id/retry` | **D-A** `TenantProvisioningService.retry` (Step 17 source) + **D-B** `platform_operations_idempotency` pending claim before effect, completed payload for HTTP/audit | Non-authoritative cache only | op, requestId, expectedRowVersion, reason | Exact replay returns completed payload; hash mismatch → 409 | Survives recreation/cache loss; concurrent race → one pending claim winner | Success audit delta = 1 |
| `POST .../entitlement-cache/invalidate` | **D-B** `PlatformOperationsIdempotencyRecord` (pending claim before invalidate) | Non-authoritative cache only | op, tenantId, confirmation, reason | Same as above | Same | Success audit delta = 1 |

## Integration health contract

Separate `enabledState`, `configurationState`, `runtimeHealth`, `queueHealth`, staleness, lastSuccess/lastFailure.

- Disabled → `DISABLED`
- Enabled + valid config + no runtime evidence → `UNKNOWN` (never `HEALTHY`)
- `HEALTHY` only from real runtime evidence (provider registry / queue diagnostics)
- Failed/DLQ backlog → `DEGRADED` / unhealthy per row
- Stale config-only foundation → non-green + `stale: true`
- No secrets, storage paths, raw payloads, PHI

## F24 classification

**F24-B — NOT APPLICABLE.** Step 22 owns no rollback/recovery compensation path.

Material actions: provisioning retry (source rollback owned by Step 17) and cache invalidate (effect-idempotent local clear; no compensator). Hook containment is proven separately (HOOK01–HOOK04): `NODE_ENV !== test` impossible; missing/invalid selector impossible; exact selector activates only that hook.

## Operator UI

| Surface | Decision |
|---------|----------|
| Provisioning retry | Surfaced in Super Admin `/operations/provisioning` — permission `tenant.provision.retry`, reason, step-up (API), idempotency, Audit Center link, UIA01–UIA18 |
| Entitlement cache invalidate | **UI-CACHE-B — API-only.** High-risk, rare, confirmation=`INVALIDATE`, no safe list UX; retain API controls (permission, step-up, reason, confirmation, idempotency, rate limit, audit). No Super Admin invalidate control. |

## Final Case C (authoritative)

| Field | Value |
|-------|--------|
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-09T23:49:44.503Z` |
| Start | `2026-08-09T23:49:43.061Z` |
| End | `2026-08-10T01:04:52.223Z` |
| Duration | 4509162 ms |
| Counters | failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0 |
| Hygiene | remaining prohibited Step 22 artifacts = 0 |

Prior Case C / attempt-1 interrupted runs are historical only and must not be combined.

## O01–O16 / routes

Thirteen routes under `/platform/operations/*`. Read adapters must not synthesize HEALTHY from missing probes. Catalog identity target: **68 / 136 / 68 / 13**.

## Feature flag

`OPERATIONS_CONSOLE_ENABLED` — disable returns route unavailable without mutating SoRs.

## Non-goals

Step 23+, billing, sales CRM, restore workflow, shell/SQL, second monitoring/queue/backup engine, inventing subscription/override expire workers.
