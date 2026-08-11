# Sales Productivity and Commission Snapshot (Flexible Step 26)

**Status:** Accepted / Complete
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 26
**Authority:** Steps 01–25 + U01 Accepted/Complete; Step 23 reps/targets; Step 24 leads; Step 25 trials/conversions; Step 16 commercial configs.

Steps **01–25** + **U01**: Accepted/Complete.
Step **26**: Accepted / Complete (narrow F02–F09 / F19 / F20 / H21 closure passed; Case C Attempt 1 remains authoritative).
Steps **27–29**: Not Authorized.

```text
Commission snapshots are review records, not payroll or accounting ledgers.
Paid status records an administrative state only and does not move money.
```

### Accepted Step 25 checkpoint (branch base)

| Field | Value |
|-------|--------|
| Checkpoint branch | `cursor/step25-trial-creation-conversion` |
| Checkpoint local SHA | `2182575f9228817f7847cc844e132f01fa0a3bf3` |
| Checkpoint remote SHA | `2182575f9228817f7847cc844e132f01fa0a3bf3` |
| Local/remote match | YES |
| Force push used | NO |
| Step 26 branch | `cursor/step26-sales-productivity-commission-snapshot` (from checkpoint) |

### Case C Attempt 1 (authoritative)

| Field | Value |
|-------|--------|
| Attempt | **1** |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze / start | `2026-08-11T21:07:48.684Z` |
| End | `2026-08-11T22:01:03.650Z` (~53.2 min) |
| Runner | `npm run test:sales-productivity-commission-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Step 23 DB | **128/128** |
| Step 24 DB | **174/174** |
| Step 25 DB | **272/272** |
| Step 26 DB | **267/267** |
| UI | **60/60** (`sales-productivity-ui.spec.tsx`) |
| Catalog | Items **68** / Translations **136** / Aliases **68** / Rules **13** |
| Hygiene | remaining prohibited Step 26 artifacts = **0** |

### Narrow failure/session closure (F02–F09, F19, F20, H21)

| Field | Value |
|-------|--------|
| Result | PASSED |
| Attempt 1 remains authoritative | YES |
| Product behavior changed (happy path) | NO — contained Model B selectors only; idle path unchanged |
| Material one-pass harness changed | NO |
| Full Case C rerun | Not required |
| Selectors | `before_lead_source_query`, `before_trial_source_query`, `before_subscription_source_query`, `before_plan_version_source_query`, `before_addon_source_query`, `before_target_source_query`, `before_attribution_source_query`, `before_completeness_eval`, `during_reconciliation`, `during_export_serialize` |
| Catalog | 68 / 136 / 68 / 13 |
| Hygiene | 0 |

---

## 1. Purpose

Transparent representative productivity metrics and **reviewable monthly commission snapshots** without building payroll, payslips, bank transfers, tax, GL, invoice/payment ledgers, or payment gateways.

---

## 2. Sources of Record (frozen)

| Concern | SoR | Notes |
|---------|-----|-------|
| Representative / manager / target | Step 23 `PlatformSalesRepresentative` | Target amount/period/currency |
| Leads / demos / won/lost / notes / next-action | Step 24 `PlatformSalesLead` (+ histories) | Owner at event time via `ownerRepresentativeId` / history |
| Trials / frozen attribution / conversions | Step 25 Trial + Conversion | Credit conversions via frozen `attributionSnapshotJson.salesAttributionId` |
| Active/cancelled commercial customers | Step 16 `PlatformSubscriptionCommercialConfig` | `isCurrent` + lifecycle; join via ownership or conversion tenant |
| Plan Version identity | Step 14 immutable `PlatformPlanVersion.id` | Never Plan display name |
| Add-on commercial grants | Step 16 `PlatformSubscriptionAddOnAssignment` + conversion dispositions | Not EER inference |
| Customer ownership (current book) | Step 23 `PlatformSalesCustomerOwnership` | Historical conversion credit ≠ live ownership rewrite |
| Commission rates/rules | **None** | `calculationStatus = UNCONFIGURED` — do not invent rates |
| Snapshot review record | `PlatformSalesCommissionSnapshot` | Review-only; not payroll |
| Durable idempotency | Shared `platform_sales_idempotency` | Ops `sales_commission.*` |
| Durable audit | Step 21 Model A | Category `sales_commission_management` |

**Rejected as SoR:** Clinic `CommissionRule` / `CommissionCalculation`; runtime EER for sales attribution; report tables as entitlement/subscription authority.

---

## 3. Time / period semantics

| Field | Contract |
|-------|----------|
| Reporting timezone | `UTC` (stored on every query/snapshot as `periodTimezone`) |
| Period key | `YYYY-MM` |
| Bound | `periodStart <= eventTimestamp < nextPeriodStart` |
| `periodStart` | First instant of calendar month in timezone (UTC: `YYYY-MM-01T00:00:00.000Z`) |
| `periodEnd` exclusive | First instant of next month |
| Late-arriving rows | Included if event timestamp falls in bound at generation `sourceCutoffAt` |
| Finalized snapshot | Does **not** silently recalculate when sources change; revision creates a new row/version under policy |

---

## 4. Attribution (frozen)

| Domain | Attribution rule |
|--------|------------------|
| Leads created / stage events | Lead `ownerRepresentativeId` at create (or stage history owner if present) |
| Activities | Durable commercial evidence only: lead notes + next-action updates + demo updates in period (not audit noise) |
| Demos scheduled | `demoStatus ∈ {SCHEDULED,COMPLETED,CANCELLED}` with `demoScheduledAt` in period |
| Demos completed | `demoStatus = COMPLETED` and `updatedAt` in period (no separate completedAt; durable state only) |
| Trials created | Trial `ownerRepresentativeId` / frozen snapshot at create |
| Conversions / paid | Frozen `attributionSnapshot.salesAttributionId` (fallback `ownerRepresentativeId`) at trial create — **never** rewritten by later owner change |
| Won / Lost | Lead owner when stage became WON/LOST (`stage history` timestamp) |
| Active customers | Current `PlatformSalesCustomerOwnership.representativeId` ∩ Step 16 `ACTIVE_COMMERCIAL` current configs |
| Cancellations | Configs entering `CANCELLED` in period (`cancelledAt` / `cancellationEffectiveAt`) attributed via ownership at cancel time if history exists, else current ownership with completeness `PARTIAL` |
| Plan Version mix | From conversions (`targetPaidPlanVersionId`) and/or current ACTIVE configs for owned tenants — snapshot stores version **ids** |
| Add-on sales | Assignments created/activated in period on paid commercial configs; trial-only grants counted only when conversion disposition migrates/retains them (once) |

---

## 5. Metric dictionary (M01–M20)

Completeness values: `COMPLETE | PARTIAL | UNAVAILABLE | NOT_APPLICABLE`.

| ID | Key | Formula / definition | Numerator | Denominator | Source | Timestamp | Incomplete | Ranking |
|----|-----|----------------------|-----------|-------------|--------|-----------|------------|---------|
| M01 | `leads_created` | Count leads with `createdAt` in period & attributed owner | count | — | Lead | `createdAt` | PARTIAL if owner null | eligible if COMPLETE |
| M02 | `activities` | Count note creates + demo updates + next-action field updates in period | count | — | Lead note / lead updates | note.`createdAt` / lead.`updatedAt` with change evidence | PARTIAL if subsystem missing | eligible if COMPLETE |
| M03 | `demos_scheduled` | Demos with `demoScheduledAt` in period | count | — | Lead | `demoScheduledAt` | PARTIAL if timezone missing (still counted in UTC) | eligible |
| M04 | `demos_completed` | `demoStatus=COMPLETED` updated in period | count | — | Lead | `updatedAt` | COMPLETE (state exists) | eligible |
| M05 | `trials_created` | Trials created in period | count | — | Trial | `createdAt` | PARTIAL if attribution missing | eligible |
| M06 | `won` | Leads entering WON in period | count | — | Stage history | history.`createdAt` | PARTIAL if history missing | eligible |
| M07 | `lost` | Leads entering LOST in period | count | — | Stage history | history.`createdAt` | same | eligible |
| M08 | `paid_conversions` | Trial conversions in period | count | — | Conversion | `convertedAt` | PARTIAL if frozen attribution missing | eligible |
| M09 | `lead_to_won_rate` | won / leads_created_in_cohort | M06 | M01 cohort | Lead | — | denom=0 → rate `null`, NOT_APPLICABLE; never 0% | not ranked on null |
| M10 | `trial_to_paid_rate` | paid_conversions / trials_created_in_period | M08 | M05 | Trial/Conversion | — | denom=0 → null | not ranked on null |
| M11 | `time_to_convert_days` | Median days lead create → conversion for conversions in period with originating lead | median | eligible conversions with lead | Lead+Conversion | — | sample&lt;3 → PARTIAL; open leads excluded | not ranked if PARTIAL |
| M12 | `active_customers` | Owned tenants with current ACTIVE_COMMERCIAL config at `sourceCutoffAt` | count | — | Ownership+Config | cutoff | PARTIAL if ownership gap | eligible |
| M13 | `cancellations` | Owned configs cancelled in period | count | — | Config | `cancelledAt` | PARTIAL | eligible |
| M14 | `plan_version_mix` | Map `planVersionId → count` for conversions in period | counts | — | Conversion | `convertedAt` | COMPLETE when ids present | N/A (composition) |
| M15 | `addon_sales` | Add-on assignment events in period on paid configs (+ migrated trial dispositions once) | count | — | AddOnAssignment / conversion dispositions | assignment createdAt / convertedAt | PARTIAL | eligible |
| M16 | `target_progress` | actual vs targetAmount when targetPeriod aligns to MONTH | actual | targetAmount | Rep target + M06/M08 | — | missing target → NOT_APPLICABLE (≠ zero) | not ranked if N/A |
| M17 | `converted_customers` | Distinct platformTenantId from conversions attributed to rep in period | count | — | Conversion+Trial | `convertedAt` | PARTIAL | eligible |
| M18 | `cancellation_attribution` | Same as M13 with explicit attribution basis recorded | count | — | Config+Ownership | cancel time | PARTIAL | eligible |
| M19 | `period_source_completeness` | Aggregate of source availability flags | — | — | Meta | cutoff | UNAVAILABLE if critical source fails | gates ranking |
| M20 | `reporting_completeness` | Worst of metric completeness in the row | — | — | Meta | cutoff | drives UI markers | gates ranking |

**Zero/null:** Missing/incomplete counts are **not** silently coerced to 0 for rates or ranking. Raw counts may be 0 when the source is COMPLETE and truly empty.

---

## 6. Completeness & ranking

Ranking is **disabled by default**. Incomplete rows are `UNRANKED`. No hidden weights. Missing target ≠ poor performance.

---

## 7. Authorization

| Permission | Use |
|------------|-----|
| `sales-report.view` | Productivity self/team read (scope enforced) |
| `sales-report.export` | CSV export (same scope as view) |
| `commission-snapshot.view` | Snapshot read (own or team by scope) |
| `commission-snapshot.review` | Review transitions |
| `commission-snapshot.generate` | Generate/revise snapshots |
| `commission-snapshot.mark-paid` | Administrative paid-status only |

Representative: own only. Manager: Step 23 subtree. Clinic denied. Suspended denied.

---

## 8. Snapshot lifecycle

Statuses: `DRAFT | FINALIZED | SUPERSEDED`  
Review: `NONE | IN_REVIEW | REVIEWED | REJECTED`  
Paid: `UNPAID | PAID` (administrative only)

```text
money movement = 0
payment ledger rows = 0
Subscription mutations = 0
Tenant mutations = 0
Entitlement mutations = 0
```

`calculationStatus` always `UNCONFIGURED`; `computedAmount` always null; no invented rates.

---

## 9. Exports

CSV via `csvSafeCell`. Same authorization as API. Formula-injection mitigation for `=+-@`. Unicode preserved. Bounded period required.

---

## 10. Non-goals

Payroll, payslips, bank, tax, GL, invoice/payment ledger, payment gateway, invented commission rates, Step 27 notifications/templates, PHI, Clinic commission module reuse.

---

## 11. API

```text
GET  /platform/sales/productivity/self
GET  /platform/sales/productivity/team
GET  /platform/sales/productivity/export
GET  /platform/sales/commission-snapshots
POST /platform/sales/commission-snapshots/generate
GET  /platform/sales/commission-snapshots/:id
POST /platform/sales/commission-snapshots/:id/review
POST /platform/sales/commission-snapshots/:id/mark-paid
```

---

## 12. Migration

Additive: `platform_sales_commission_snapshots` (+ indexes); widened shared idempotency `resultResourceType` to 64. No auto-generated snapshots. Catalog `68/136/68/13`. No Step 27 / payroll tables.
