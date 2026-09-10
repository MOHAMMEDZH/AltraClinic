# WAVE H AUTHORITATIVE SCOPE

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-h-ux-localization` |
| Evidence SHA | `c64a435` |
| Wave name | UX / Localization / Accessibility |
| P1 / ADR | P1-08, P1-12; owner inventory/commission UX (bounded); AR-02 search identity |
| Status language | Review evidence only — **no ACCEPTED / FROZEN PA claim** |

## In scope (delivered H0–H4)

| Slice | P1 / intent | Deliverable |
|-------|-------------|-------------|
| H0 | Kickoff | Frozen scope / acceptance / slices docs |
| H1 | P1-08 search | Arabic catalog search includes active aliases + unit/PG proofs |
| H2 | P1-08 booking | RTL booking quality + catalog API search UI wiring |
| H3 | P1-12 | Accessibility + tablet reception pack (axe without critical disableRules on booking paths) |
| H4 | Owner UX (bounded) | Read-only inventory usage owner-report + staff-commission owner summary on existing routes |
| H5 | QA / PA package | Pack re-proof + this review package + external PA precheck |

## Out of scope

- Wave I onepass; Phase 49 / Step 30; Phase 50 polish dump
- Portal / POS / payroll
- Reopening Wave F commission math or Wave G engagement SoR
- Binding `AppointmentForm` to clinical-catalog identity picker
- Broad axe sweeps of every module
- New auth stacks / SoR / accrual / settlement / ledger changes
- Self-granted Wave H Production Acceptance

## Frozen QA pack names

```text
P1 Arabic/RTL Pack = FROZEN (H1 + H2)
P1 Accessibility/Tablet Pack = FROZEN (H3)
Owner inventory/commission UX (bounded) = FROZEN (H4)
```
