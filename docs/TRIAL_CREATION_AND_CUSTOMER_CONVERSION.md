# Trial Creation and Customer Conversion (Flexible Step 25)

**Status:** Accepted / Complete
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 25
**Authority:** Steps 01–24 + U01 Accepted/Complete; Step 16 Subscriptions; Step 17 Provisioning; Step 18 EER; Step 19 Lifecycle.

Steps **01–24** + **U01**: Accepted/Complete.
Step **25**: Accepted / Complete (narrow matrix evidence closure passed).
Steps **26–29**: Not Authorized (no commission/productivity, billing invoicing systems, PHI).

### Case C Attempt 3 (authoritative)

Attempt **1** INVALIDATED (operations-console / sales-representatives clean validators still forbade `platform_sales_trials`).
Attempt **2** INVALIDATED during narrow matrix closure (executable product behavior change: CONVERTED short-circuit now enforces durable same-key / different-payload `idempotency_conflict` for I09).
Attempt **3** is authoritative.

| Field | Value |
|-------|--------|
| Attempt | **3** |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-11T19:27:21.900Z` |
| Window | `2026-08-11T19:27:21.504Z` → `2026-08-11T20:17:48.082Z` (~50.4 min) |
| Branch / commit | `cursor/step25-trial-creation-conversion` @ `a21149d934734d8ec48058becc55b659be303cc2` (+ closure working tree) |
| Runner | `npm run test:trials-conversion-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Step 23 DB | **128/128** |
| Step 24 DB | **174/174** |
| Step 25 DB | **272/272** |
| UI | **62/62** (`sales-trials-ui.spec.tsx`) |
| Catalog | Items **68** / Translations **136** / Aliases **68** / Rules **13** |
| Hygiene | remaining prohibited Step 25 artifacts = **0** |

### Narrow matrix closure (explicit IDs)

| Matrix | Result |
|--------|--------|
| A11–A26 audit | PASS (A13/A18/A19 rigorous policy N/A) |
| I09–I16 durable idempotency | PASS |
| C06–C24 concurrency | PASS (C06 rigorous N/A — no Trial Override update API) |
| F09–F30 failure injection | PASS |
| H25–H50 real Passport HTTP | PASS |
| P01–P12 privacy | PASS |
| RTE01–RTE08 runtime entitlement | PASS (explicit mapped assertions) |

---

## 1. Purpose

Governed Trial tenants that reuse the same Catalog, Plan Version, Add-on, Limit, Override, Subscription, Provisioning, Lifecycle, EER, and U01 authorities as paid customers, with deterministic expiry enforcement and conversion to a published paid Plan Version while preserving Steps 23/24 sales attribution.

---

## 2. Source of Record decisions

| Concern | SoR | Notes |
|---------|-----|-------|
| Trial governance lifecycle | **`PlatformSalesTrial`** (dedicated aggregate) | Extension history, conversion durability, attribution snapshot, expiry claim, OCC |
| Entitlements / limits | Step 16 commercial snapshot + Step 18 EER | **No** parallel Trial entitlement engine |
| Tenant | Step 17 / PlatformTenant | Trial create resolves/creates Tenant via accepted provisioning adapter |
| Subscription / commercial config | Step 16 | Trial activation establishes commercial config; conversion updates paid path |
| Provisioning | Step 17 patterns + Step 16 service | Idempotent commercial activation |
| Lifecycle | Step 19 | Explicit mapping for active / expired / converted |
| Usage / limits | U01 via EER | No separate Trial meter authority |
| Attribution | Frozen snapshot on Trial + Lead/Rep FKs | Owner reassignment must not rewrite historical attribution |
| Audit | Step 21 Model A (sentinel tenant) | Mirror sales-lead audit pattern |
| Idempotency | `platform_sales_idempotency` (shared sales durable store) | Operation namespaces `sales_trial.*` |
| Conversion event | Outbox (`outbox_events`) after durable conversion commit | Replay-safe, no PHI/secrets |
| Expiry job | Existing Nest cron → BullMQ (`SALES_TRIAL_EXPIRY`) | No second scheduler |

**Rejected:** treating legacy `GrantTenantTrialHandler` as Step 25 SoR.

---

## 3. Trial aggregate (governance)

Persisted: `platform_sales_trials`, `platform_sales_trial_extension_history`, `platform_sales_trial_conversions`.

Statuses: `DRAFT | PENDING_PROVISIONING | ACTIVE | EXPIRED | CONVERTED | CANCELLED`.

---

## 4–15. Contract freeze (unchanged from implementation)

Duration/extension policy, Plan Version rules, limits/Add-ons/Overrides disposition, attribution, APIs under `/platform/sales/trials`, permissions `trial.*`, expiry job semantics, conversion workflow, entitlement comparison preview (SoR deltas = 0), rollback rules — as implemented and evidenced by Case C Attempt 3.

### Audit policy notes (A13 / A18 / A19)

- Extension **request** is not a distinct audited action; only successful `sales_trial.extended` is audited (A13 N/A).
- Entitlement comparison preview is strictly read-only and emits **no** audit write (A18 N/A by policy; delta proven = 0).
- Conversion **request** is not a distinct audited action; only successful `sales_trial.converted` is audited (A19 N/A).

### Product behavior change during closure (Attempt 2 → Attempt 3)

CONVERTED short-circuit now consults the durable idempotency request hash so the same Idempotency-Key with a different paid Plan Version target yields `idempotency_conflict` (I09) instead of silently returning the prior conversion.

### Test-only failure hooks (Model B)

Added selectors (unreachable unless `NODE_ENV === "test"` AND exact env match): `after_conversion_commit_before_response`, `eer_invalidation`, `comparison_preview_dependency`. No default production semantic change.

## Non-goals preserved

Step 26 commission/productivity, billing invoice/payment, parallel entitlement engine, PHI — not implemented; validators forbid those tables.
