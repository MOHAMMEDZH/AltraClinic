# Wave F Frozen Scope Extract

**Wave:** Phase 48 Wave F — Workforce Commercials
**Base checkpoint:** `70b1ef66b2be109baff1aafb0883f3185c512d08` (Wave E FROZEN / REMOTE VERIFIED)
**Branch:** `cursor/phase48-wave-f-workforce-commercials`

## Source documents (authoritative)

| Document | Role |
|----------|------|
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | ADR freeze AR-21/AR-22; commission freeze §6 |
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Wave F entry/exit; P1-14 QA pack |
| `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md` | StaffCommissionPlanVersion / CommissionAccrual contracts |
| `docs/PHASE_48_STAFF_COMMISSION_REVENUE_SHARE_ARCHITECTURE.md` | Detailed AR-21+AR-22 design |
| `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` | Domain ownership |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | QA acceptance categories |
| `docs/PHASE_48_DENTAL_AESTHETIC_BOOKING_GAP_MATRIX.md` | Context only (no Wave F financial invention) |

## P1-14 interpretation

**Staff Commission / Revenue Share** — owner-facing versioned % plans, performer attribution via ServicePerformance, append-only accruals, refund reversals, settlement reference (not payroll). Default OFF for existing users; no fabricated history.

## AR-22 interpretation

**Versioned commission plans + accruals** — IMPROVE legacy commission module:

- `StaffCommissionPlanVersion` (evolved from / alongside preserved `CommissionRule`)
- `CommissionAccrual` append-only ledger (`PENDING` / `EARNED` / `SETTLED` / `REVERSED`)
- Permissions conceptually `staff.commission.*` mapped to Nest resource `api.staff-commission` for matrix consistency with Wave D/E `api.*` pattern
- Settlement reuses commission PAID/reference semantics on accrual (no new payroll engine)

## AR-21 reuse (not re-implemented)

`ServicePerformance` + `ServicePerformanceParticipant` already shipped in Wave D and reused by Wave E. Wave F **must** use participants as performer SoR. `Appointment.providerId` must **never** auto-attribute commission.

## Frozen commercial rules

| Topic | Frozen decision |
|-------|-----------------|
| Owner enable/disable | YES — `commissionEnabled` default **false** |
| Default percentage | 0–100 |
| Plan versioning | YES — rate change = new version; past accruals keep prior version id |
| Historical recalculation from current rate | **NO** |
| Performer source | `ServicePerformanceParticipant` only |
| Default calculationBasis | `SERVICE_NET_AFTER_DISCOUNT` |
| Default earningTrigger | `INVOICE_OR_CHARGE_FINALIZED` |
| Also support | `SERVICE_GROSS`, `SERVICE_NET_EXCLUDING_TAX`, `COLLECTED_REVENUE` |
| Full refund after earn | full REVERSAL row |
| Partial refund | proportional REVERSAL |
| Cancel before earn | no EARNED accrual |
| Rounding | tenant currency minor-unit **half-up** |
| Multi-currency mismatch | fail closed |
| Share sum | ≤ 100%; double-count forbidden |
| First wave plan scope | **user default only**; branch/service overrides extension-ready |
| Payroll engine | **NO** |

## Snapshot / history

- Accruals are append-only; reverse via new row (`reversalOfAccrualId`), never silent overwrite
- Accrual stores `commissionPlanVersionId`, percent, amounts, basis at post time
- Manual correction: permission + reason + audit (+ reverse/re-post)

## Permissions (frozen conceptual → API resources)

| Frozen | Wave F API resource |
|--------|---------------------|
| staff.commission.configure | `api.staff-commission` create/update (publish/supersede) |
| staff.commission.view | `api.staff-commission` view |
| staff.commission.correct | `api.staff-commission` manage (correction) |
| staff.commission.settle | `api.staff-commission` approve (settle) |
| staff.commission.owner-report | `api.staff-commission` export |
| service.performance.* | already `api.service-performance` (unchanged) |

Self-edit denied by default (actor cannot configure/correct own accruals unless owner/super_admin).

## Audit (mandatory categories)

commission enabled/disabled; plan version published; percentage/basis changed; accrual created/reversed; manual adjustment; settlement.

## Migration freeze

- existing users `commissionEnabled` default OFF
- invented historical commission = NO
- existing `CommissionRule` / `CommissionCalculation` preserved LEGACY-compatible
- destructive remapping = NO

## Out of scope (explicit)

- Wave G engagement / recall / waitlist
- Wave H RTL / localization / a11y / owner UX polish dump
- Wave I enterprise QA closure pack execution beyond Wave F gates
- Phase 49 / Step 30
- Full payroll / tax-law engine
- Fabricated historical accruals or performers
- Second ServicePerformance / billing / inventory ledger
- Blind `Appointment.providerId` commission attribution
- Silent historical rate rewrite
- Branch/service plan override UI as mandatory first-wave (schema extension-ready only)
