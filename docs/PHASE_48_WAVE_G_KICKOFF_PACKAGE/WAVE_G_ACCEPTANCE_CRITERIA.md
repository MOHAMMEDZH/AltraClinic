# Wave G — Acceptance Criteria (Production-Acceptance style)

Kickoff checklist for **future** Wave G Production Acceptance.  
**This document does not accept Wave G.** No implementation in this package.

**SSOT:** `WAVE_G_FROZEN_SCOPE_EXTRACT.md` + Architecture Freeze / Frozen QA Plan.

---

## 0. Entry gates (preconditions)

- [ ] Canonical base includes Wave F merge (`c202114` or later accepted tip).
- [ ] Booking integrity foundations stable (Phase 48 Waves B+ scheduling concurrency / eligibility as required by freeze entry: “Booking integrity stable”).
- [ ] Explicit CTO **implementation** authority granted for Wave G (kickoff alone is insufficient).
- [ ] Wave F / 3F remain closed (no reopen without new product failure).

---

## 1. Sources of Record (must exist)

| SoR | Required | Isolation | Lifecycle |
|-----|----------|-----------|-----------|
| `RecallRule` (semantics) | YES | tenant-scoped; write `outreach.admin` | soft delete; active flag |
| `PatientRecallInstance` | YES | tenant + PHI; write outreach/scheduling | statuses include DUE \| SNOOZED \| BOOKED \| COMPLETED \| OPTED_OUT |
| `AvailabilityException` | YES | tenant/branch; write `schedule.admin` | soft delete; typed exceptions |
| Waitlist offer/TTL path | YES (behavior on/near waitlist) | tenant-scoped | offer → accept \| timeout; default **no** silent auto-book |

Cross-tenant access: **DENY**.

---

## 2. Behavioral acceptance

### P1-13 / AR-17 Recall

- [ ] RecallRule is the **operational SoR** (not journey registry alone, not reminder-only).
- [ ] Instances can progress due→book→complete (and snooze / opt-out as frozen).
- [ ] Notifications may deliver; they do not replace the SoR.
- [ ] Audit on rule/instance material changes (freeze audit categories include outreach-relevant actions).

### P1-10 Waitlist auto-fill

- [ ] On appointment CANCELLED (and other frozen triggers if added under ACR): select OPEN candidates by rules.
- [ ] System creates **offer with TTL** and notifies.
- [ ] **First valid accept wins** under same concurrency/lock model as booking.
- [ ] TTL expiry clears/expires offer without booking.
- [ ] **Default:** no auto-book without explicit tenant policy flag.
- [ ] Race tests: two accepts / accept-vs-timeout under Postgres + API.

### P1-11 AvailabilityException

- [ ] Types supported: PROVIDER_LEAVE, BRANCH_HOLIDAY, RESOURCE_MAINTENANCE, EXTRA_AVAILABILITY (semantics).
- [ ] Precedence: exception **deny > weekly open**; **EXTRA adds slots**.
- [ ] Timezone = branch/tenant policy.
- [ ] Scheduling conflict / open-slot calculation honors exceptions.

---

## 3. Tenant / security

- [ ] All Wave G writes enforce tenant (and branch where applicable).
- [ ] Cross-tenant reads/writes fail closed.
- [ ] PHI minimized in audit payloads (IDs + action metadata).
- [ ] Permissions align with freeze conceptual authz (`outreach.admin`, `schedule.admin`, scheduling permissions for offer accept).

---

## 4. Tests required (frozen pack intent)

| Pack | Minimum assert (from Enterprise QA Acceptance Architecture) | Layers |
|------|---------------------------------------------------------------|--------|
| P1 Waitlist Pack | offer/accept/timeout races under same lock model | Postgres + API |
| P1 Availability Pack | AvailabilityException precedence | unit + API |
| P1 Recall Pack | RecallRule due→book→complete; ≠ reminder only | API + notifications |

Also required for PA hygiene (implementation phase):

- [ ] Unit coverage for precedence / TTL / status transitions.
- [ ] Postgres integration for races and tenant isolation.
- [ ] Permission / licensed-module gates where applicable.
- [ ] No reliance on disabling critical axe/security asserts to “pass”.

Release 47 / Clinic Dashboard / Platform DB / Super Admin gates: **must remain green** on the accepting SHA (Wave I will re-assert globally; Wave G must not regress them).

---

## 5. Explicit non-goals (acceptance must NOT require)

- Patient portal expansion, POS/cashbox SoR, payroll.
- Wave H RTL/a11y closure or Wave I full onepass.
- Phase 49 / Step 30.
- Dermatology EMR entity.
- Reopening Wave F commission semantics.
- Silent auto-book without policy.
- Declaring PASS because basic waitlist CRUD + cancel notify exists.

---

## 6. Exit sign-off block (for later CTO use)

```text
WAVE G PRODUCTION ACCEPTANCE = ________ (PENDING / ACCEPTED)
Evidence SHA = ________
P1-10 = ________
P1-11 = ________
P1-13 / AR-17 = ________
Waitlist Pack = ________
Availability Pack = ________
Recall Pack = ________
Regressions (CD / Platform DB / Super Admin / Phase 28) = ________
```
