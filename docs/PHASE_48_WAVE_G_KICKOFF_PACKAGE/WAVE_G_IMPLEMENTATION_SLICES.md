# Wave G — Implementation Slices (ordered)

**Status:** Planning only. **No schema/services/e2e changes in this package.**  
Implementation requires a **later** CTO authority prompt.

**Recommended first slice for next authorization:** **G0 → G1 (AvailabilityException SoR)** — see rationale below.

---

## Dependency overview

```text
G0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs]
        │
        ▼
G1 AvailabilityException SoR (P1-11)      ← preferred first implementation
        │
        ▼
G2 Waitlist offer / TTL / accept (P1-10)  ← builds on booking locks + cancel hook
        │
        ▼
G3 RecallRule + PatientRecallInstance (P1-13 / AR-17)
        │
        ▼
G4 Clinic UX + permissions polish (minimal for packs)
        │
        ▼
G5 QA packs green + Production Acceptance evidence
```

Parallelism note: G3 (Recall) has weak runtime dependency on G1/G2 but **shares** scheduling/notifications plane — serialize after G1 to reduce merge conflict on `scheduling` module; G3 can start after G1 if staffing allows, but **do not** start G2 and G3 in the same unauthorized big-bang.

---

## Slice G0 — Kickoff package (complete)

| | |
|--|--|
| **Deliverable** | This folder + evidence summary |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice G1 — AvailabilityException SoR (P1-11) — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Introduce AvailabilityException semantics + precedence in booking/open-slot evaluation |
| **Depends on** | Existing scheduling resources / weekly hours; schedule.admin conceptual authz |
| **Includes** | Model(s), APIs, precedence unit tests, tenant isolation, audit hooks |
| **Types** | PROVIDER_LEAVE, BRANCH_HOLIDAY, RESOURCE_MAINTENANCE, EXTRA_AVAILABILITY |
| **Exit of slice** | Exception deny beats weekly open; EXTRA adds slots; timezone policy respected |
| **Risks** | Incorrect precedence silently opens/closes clinics; operatory maintenance overlap with Wave D resources — keep single SoR (P1-11) |
| **Why first** | Smallest closed SoR; unblocks correct free-slot signals for waitlist offers; fewer PHI surfaces than Recall |

---

## Slice G2 — Waitlist offer / TTL / accept (P1-10)

| | |
|--|--|
| **Goal** | Upgrade cancel→notify path into offer/TTL/accept under booking locks |
| **Depends on** | G1 (accurate availability); existing `AppointmentWaitlist`; concurrency locks from Wave B |
| **Includes** | Offer state machine; TTL worker/timeout; accept API (sync txn); policy flag default OFF for auto-book; race tests |
| **Reuse** | `AppointmentWaitlist` candidates; `AppointmentCancelledWaitlistListener` hook point; clinic waitlist list |
| **Must replace** | “Contact reception” as the only fulfillment path for auto-fill (may remain as fallback copy for non-offer notifies) |
| **Risks** | Double-book races; enum migration from OPEN/SCHEDULED/CANCELLED; accidental auto-book; notification spam |

---

## Slice G3 — Recall SoR (P1-13 / AR-17)

| | |
|--|--|
| **Goal** | RecallRule + PatientRecallInstance operational SoR |
| **Depends on** | Clinical service identity (Wave A catalog); notifications delivery plane |
| **Includes** | Rules CRUD; instance lifecycle; due scan job; book/complete paths; prove ≠ reminder-only |
| **Risks** | PHI; confusing with journey registry; over-scoping eligibilityExpr; duplicate “reminder” products |

---

## Slice G4 — Minimal UX / permissions

| | |
|--|--|
| **Goal** | Reception/outreach/schedule admin surfaces sufficient for QA packs |
| **Depends on** | G1–G3 APIs |
| **Includes** | Exception calendar/list; offer accept UX; recall queue; permission wiring |
| **Out of scope** | Wave H a11y/RTL closure, portal, POS |

---

## Slice G5 — Packs + Production Acceptance

| | |
|--|--|
| **Goal** | P1 Waitlist / Availability / Recall packs green; PA evidence package; no CD/Platform DB/Super Admin/Phase 28 regressions |
| **Depends on** | G1–G4 |
| **Deliverable** | Implementation review package (mirror Wave E/F style) + external PA precheck |

---

## Explicit non-slices

- Wave H / I / Phase 49  
- Wave F commission edits  
- Portal / POS / payroll  
- Big-bang single PR for G1+G2+G3 without intermediate review  

---

## Risk register (wave-level)

| Risk | Mitigation |
|------|------------|
| Mistaking current waitlist for P1-10 done | Gate on offer/TTL/accept tests only |
| Formal PA backlog for B–E | CTO call: proceed G vs paperwork first — kickoff assumes G authorized |
| Scheduling module contention | Slice order G1→G2; small PRs |
| Silent auto-book | Default policy OFF; explicit tests |
