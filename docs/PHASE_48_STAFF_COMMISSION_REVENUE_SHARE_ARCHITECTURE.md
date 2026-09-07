# Phase 48 — Staff Commission / Revenue Share Architecture (AR-21 + AR-22)

| Field | Value |
|-------|--------|
| **ADRs** | AR-21 Service Performance Attribution; AR-22 Staff Commission / Revenue Share |
| **Priority** | P1-14 |
| **Implementation** | NOT AUTHORIZED |
| **Payroll engine** | **NO** (do not duplicate) |

Reuse existing: `apps/api/src/modules/commission`, `CommissionRule`, `CommissionCalculation`, `CommissionLineItem`, invoice/payment/refund SoRs, `User`.

---

## 1. AR-21 ServicePerformance

Commission and owner “who did the work” use **ServicePerformance**, not blind `Appointment.providerId`.

```text
ServicePerformance
  tenantId, branchId?
  appointmentId?, encounterId?
  clinicalServiceId
  snapshotRevisionId?
  performedAt
  status                  # DRAFT | COMPLETED | CANCELLED

ServicePerformanceParticipant
  performanceId
  userId                  # User id — never free-text name
  role                    # PRIMARY | ASSISTING
  attributionShare?       # 0–100; sum of revenue shares ≤ 100%
  recordedBy, recordedAt
```

| Rule | Decision |
|------|----------|
| Appointment.providerId as automatic performer | **NO** |
| Multi-performer | PRIMARY required; ASSISTING optional |
| Double-count attributed revenue | **FORBIDDEN** (share sum ≤ 100%) |
| Cross-tenant participant | DENY |
| Inactive user attribution | DENY for new posts |
| After COMPLETED | immutable except audited correction revision |

Draft editable before completion; completed attribution locked.

---

## 2. Owner UX (mandatory)

At user/staff create/edit:

```text
Receives commission?  YES / NO
Default commission percentage  0–100
Effective from (date)
```

```text
commissionEnabled = false  ⇒  no automatic accrual
```

User may still perform services and consume inventory.

```text
ProviderServiceEligibility != commission eligibility
```

---

## 3. AR-22 Versioned commission plan

**IMPROVE** `CommissionRule` into versioned plan semantics (table may evolve in place):

```text
StaffCommissionPlanVersion
  id
  tenantId
  userId
  branchId?                 # optional branch override
  clinicalServiceId?        # optional service override (extension)
  enabled
  percentage                # 0..100 for PERCENTAGE plans
  rateType                  # reuse CommissionRateType (PERCENTAGE primary for owner UX)
  calculationBasis          # see §4
  earningTrigger            # tied to basis
  effectiveFrom
  effectiveTo?
  status                    # DRAFT | ACTIVE | SUPERSEDED
  createdBy
  publishedAt
```

Changing 25% → 30% = **new version**. Past accruals keep prior version id.

Optional future overrides without redesign:

```text
precedence (authoritative):
  service-specific branch override
  → service-specific tenant override
  → branch default
  → tenant/user default
  → disabled / no commission
```

First implementation wave may ship **user default only**; overrides are extension-ready.

---

## 4. Calculation basis & earning trigger

Extensible enum; **recommended default**:

```text
calculationBasis = SERVICE_NET_AFTER_DISCOUNT
earningTrigger   = INVOICE_OR_CHARGE_FINALIZED
```

Also support (extensible):

| Basis | Earn when |
|-------|-----------|
| SERVICE_GROSS | charge finalized |
| SERVICE_NET_AFTER_DISCOUNT | charge finalized |
| SERVICE_NET_EXCLUDING_TAX | charge finalized |
| COLLECTED_REVENUE | payment collected (partial → proportional earn) |

Documented behaviors:

| Topic | Rule |
|-------|------|
| Discount | Included in NET_AFTER_DISCOUNT |
| Tax | Excluded for NET_EXCLUDING_TAX; policy explicit per basis |
| Complimentary / zero snapshot | No commission (or 0 accrual with reason) |
| Write-off | No earn / reverse if previously earned per policy |
| Package/course | Allocate per session/performance share of package revenue (explicit allocation rule at post) |
| Multi-currency | Fail closed on mismatch unless explicit conversion policy exists |
| Rounding | Tenant currency minor-unit half-up unless finance SoR defines otherwise |
| Payroll/tax law | **Out of scope** — settlement reference only |

---

## 5. Commission accrual ledger

**IMPROVE** line-level accruals (may map from `CommissionLineItem` + calculation header):

```text
CommissionAccrual
  tenantId, branchId?
  userId
  servicePerformanceId
  appointmentId?
  clinicalServiceId
  snapshotRevisionId?
  invoiceLineId?
  commissionPlanVersionId
  calculationBasis
  attributedRevenueAmount
  commissionPercent
  commissionAmount
  currency
  status                  # PENDING | EARNED | SETTLED | REVERSED
  earnedAt?, settledAt?
  reversalOfAccrualId?
  createdAt, createdBy/system
```

Map to existing statuses where practical:

| Target | Existing analogue |
|--------|-------------------|
| PENDING | DRAFT-ish / pre-earn |
| EARNED | CALCULATED / APPROVED |
| SETTLED | PAID |
| REVERSED | new reversal row (append-only) |

Rules:

- never silently recalculate from **current** percentage
- refund/cancel → reversal/adjustment rows
- user delete/deactivate does not erase history
- cross-tenant DENY
- manual correction: permission + reason + audit

```text
historical recalculation from current rate = NO
```

---

## 6. Refunds / cancellations

| Event | Commission effect |
|-------|-------------------|
| Cancel before earning trigger | no EARNED accrual |
| Full refund after earn | full REVERSAL |
| Partial refund | proportional REVERSAL |
| Invoice correction | reverse + re-post |
| No-show / complimentary | no earn (unless collected fee policy says otherwise) |
| Package partial consume | accrue only completed attributable performances |

Never delete accrual history.

---

## 7. Settlement (minimal)

Reuse `CommissionCalculation` payment fields / PAID status as **settlement reference**.

Owner views: earned / settled / outstanding / reversed.

```text
full payroll engine introduced = NO
```

---

## 8. Owner reporting

```text
employee/user, provider, branch, service, date range,
plan version, earned, settled, outstanding, reversed, attributed revenue
```

Drilldown: ServicePerformance → snapshot revision → invoice line → inventory usages → accruals.

Example:

```text
Dr. X — services 42 — attributed revenue 18,500 — earned 5,550 — settled 4,000 — outstanding 1,550
```

---

## 9. Combined traceability chain

```text
ServicePerformance (+ participants)
→ Appointment / Encounter
→ Canonical Clinical Service
→ Effective AppointmentServiceSnapshot revision
→ InvoiceLine / revenue source
→ InventoryUsageLedger (+ InventoryBatch)
→ CommissionAccrual (plan version)
```

Owner outcome: who performed, what revenue, what stock/batch used, what commission earned.

---

## 10. Authorization

```text
staff.commission.configure
staff.commission.view
staff.commission.correct
staff.commission.settle
staff.commission.owner-report
service.performance.record
service.performance.correct
```

```text
provider eligibility != commission eligibility
inventory permission != commission permission
staff self-edit commission = denied by default
cross-tenant = deny
```

---

## 11. Audit

```text
commission enabled/disabled
plan version published
percentage/basis changed
service attribution created/corrected
accrual created / reversed
manual adjustment
settlement
```

No unnecessary PHI in payloads.

---

## 12. Migration

```text
existing users commissionEnabled default = FALSE
invented historical commission = NO
invented historical performer attribution = NO
existing CommissionRule/Calculation rows preserved (LEGACY-compatible)
destructive remapping = NO
```

Do not retroactively create accruals unless controlled import with provenance.

---

## 13. P1-14 QA pack (summary)

Disabled→no accrual; 30% correct; historical 25% survives new 30%; performer≠appointment.providerId; multi-performer no double-count; basis/tax/discount/partial collection; refund reversals; cancel before earn; correction authz; settled vs outstanding; cross-tenant deny; self-edit denied; owner report reconciles to invoice/service.

**Combined Traceability Pack:** ServicePerformance → snapshot → invoice → inventory usage/batch → commission accrual.
