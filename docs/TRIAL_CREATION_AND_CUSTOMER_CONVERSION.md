# Trial Creation and Customer Conversion (Flexible Step 25)

**Status:** Accepted / Complete  
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 25  
**Authority:** Steps 01–24 + U01 Accepted/Complete; Step 16 Subscriptions; Step 17 Provisioning; Step 18 EER; Step 19 Lifecycle.

Steps **01–24** + **U01**: Accepted/Complete.  
Step **25**: Accepted / Complete.  
Steps **26–29**: Not Authorized (no commission/productivity, billing invoicing systems, PHI).

### Case C Attempt 2 (authoritative)

Attempt **1** INVALIDATED (operations-console / sales-representatives clean validators still forbade `platform_sales_trials`). Attempt **2** is authoritative.

| Field | Value |
|-------|--------|
| Attempt | **2** |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-11T15:09:53.675Z` |
| Window | `2026-08-11T15:09:53.280Z` → `2026-08-11T15:59:59.808Z` (~50.1 min) |
| Runner | `npm run test:trials-conversion-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Step 23 DB | **128/128** |
| Step 24 DB | **174/174** |
| Step 25 DB | **160/160** |
| UI | **62/62** (`sales-trials-ui.spec.tsx`) |
| Catalog | Items **68** / Translations **136** / Aliases **68** / Rules **13** |
| Hygiene | remaining prohibited Step 25 artifacts = **0** |

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

Duration/extension policy, Plan Version rules, limits/Add-ons/Overrides disposition, attribution, APIs under `/platform/sales/trials`, permissions `trial.*`, expiry job semantics, conversion workflow, entitlement comparison preview (SoR deltas = 0), rollback rules — as implemented and evidenced by Case C Attempt 2.

## Non-goals preserved

Step 26 commission/productivity, billing invoice/payment, parallel entitlement engine, PHI — not implemented; validators forbid those tables.
