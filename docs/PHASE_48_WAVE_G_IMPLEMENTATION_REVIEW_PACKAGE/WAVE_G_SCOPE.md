# WAVE G AUTHORITATIVE SCOPE

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-g-engagement` |
| Evidence SHA | `22b3b5d` |
| Wave name | Engagement |
| P1 / ADR | P1-10, P1-11, P1-13 / AR-17 |
| Status language | Review evidence only — **no ACCEPTED / FROZEN PA claim** |

## In scope (delivered G1–G4)

| Slice | P1 / ADR | Deliverable |
|-------|----------|-------------|
| G1 | P1-11 | `AvailabilityException` SoR + precedence in open-slot evaluation |
| G2 | P1-10 | `WaitlistOffer` offer/TTL/accept under booking locks; `waitlist.auto_book` default OFF |
| G3 | P1-13 / AR-17 | `RecallRule` + `PatientRecallInstance` operational SoR; due-scan API; lifecycle transitions |
| G4 | UX for packs | Clinic-dashboard Appointments panels + `api.scheduling` gates |
| G5 | QA / PA package | Pack re-proof + this review package + external PA precheck |

## Out of scope

- Wave H a11y/RTL closure; Wave I onepass; Phase 49 / Step 30
- Patient portal expansion; POS/cashbox; payroll
- Dermatology EMR; Wave F commission reopen
- Silent auto-book without policy
- Dedicated `api.outreach` permission stack (conceptual `outreach.admin` → wired via `api.scheduling`)
- Self-granted Wave G Production Acceptance

## Frozen QA pack names

```text
P1 Waitlist Pack = FROZEN (G2)
P1 Availability Pack = FROZEN (G1)
P1 Recall Pack = FROZEN (G3)
```
