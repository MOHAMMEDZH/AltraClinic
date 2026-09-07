# Wave F Scope

**Wave:** Phase 48 Wave F — Workforce Commercials
**ADRs:** AR-21 (reuse), AR-22 (implement)
**P1:** P1-14
**Base:** Wave E `70b1ef66b2be109baff1aafb0883f3185c512d08`
**Branch:** `cursor/phase48-wave-f-workforce-commercials`

## In scope

- User `commissionEnabled` default OFF + default %
- `StaffCommissionPlanVersion` DRAFT → ACTIVE → SUPERSEDED
- `CommissionAccrual` append-only EARNED / SETTLED / REVERSED
- ServicePerformanceParticipant attribution (no Appointment.providerId)
- Default basis `SERVICE_NET_AFTER_DISCOUNT`; earn via explicit post with invoice line (INVOICE_OR_CHARGE_FINALIZED)
- Full/partial refund reversals (append-only)
- Settlement reference (EARNED→SETTLED)
- Owner report aggregates
- Permissions `api.staff-commission`
- RLS + tenant FK triggers + migration clean/upgrade validators

## Out of scope

- Wave G/H/I, Phase 49, Step 30
- Payroll engine
- Fabricated historical accruals
- Mandatory branch/service plan override resolution (extension-ready columns only)
- Auto-listener on every invoice event (production path is explicit post API; fail-closed)

See `WAVE_F_FROZEN_SCOPE_EXTRACT.md`.
