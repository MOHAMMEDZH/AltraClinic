# Wave G Frozen Scope Extract

Kickoff package only — **not** an implementation or Production Acceptance claim.

**Canonical base:** `release47-step22-transfer-20260810-0353` @ `c2021148ea3ce91d8323274748bd9696e4c13a56`  
**Wave F / PR #1 / Remediation 3F:** CLOSED — do not reopen.

## Source authority (SSOT)

| Document | Binding use |
|----------|-------------|
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | AR-17; P1 register; core contracts Recall / Waitlist / Availability |
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Wave G Engagement table + P1 QA pack names |
| `docs/PHASE_48_FROZEN_DOMAIN_CONTRACT_MATRIX.md` | RecallRule / PatientRecallInstance / AvailabilityException rows |
| `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` | §§16–18 behavioral contracts (bound under freeze) |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | Waitlist / Holiday-leave / Recall pack asserts |

Exact Prisma names may vary; **semantics below are frozen**.

---

## Official Wave G name

**Engagement**

## Frozen Wave G table (verbatim-bound)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`:

| Item | Value |
|------|-------|
| P0/P1 | P1-10, P1-11, P1-13 |
| ADRs | AR-17 |
| Domains | RecallRule/Instance; waitlist auto-fill; AvailabilityException |
| QA | Waitlist; Availability; Recall |
| Entry | Booking integrity stable |
| Exit | Operational recall SoR; offer/TTL waitlist; exception precedence |

Frozen P1 QA pack names:

```text
P1 Waitlist Pack = FROZEN
P1 Availability Pack = FROZEN
P1 Recall Pack = FROZEN
```

---

## AR-17 (bound)

From Architecture Freeze ADR matrix:

| ADR | Decision | Authoritative SoR | Scope | Write owner | Historical rule | Tenant rule | QA pack | Wave | Status |
|-----|----------|-------------------|-------|-------------|-----------------|-------------|---------|------|--------|
| AR-17 | RecallRule + PatientRecallInstance | Recall SoR | tenant | outreach.admin | soft | reminders ≠ SoR | Recall | G | **FROZEN** |

From Frozen Domain Contract Matrix:

| Concept | Source of Record | Scope | Write Authority | Tenant Isolation | Delete Policy | Audit | Primary QA Pack | Wave |
|---------|------------------|-------|-----------------|------------------|---------------|-------|-----------------|------|
| RecallRule | RecallRule | tenant | outreach.admin | tenant-scoped | soft | YES | Recall | G |
| PatientRecallInstance | PatientRecallInstance | patient | outreach/scheduling | tenant + PHI | soft | YES | Recall | G |

From Target Domain Architecture §16:

```text
RecallRule { tenantId, clinicalServiceId?, intervalDays, eligibilityExpr, active }
PatientRecallInstance { patientId, ruleId, dueAt, status DUE|SNOOZED|BOOKED|COMPLETED|OPTED_OUT, lastQualifyingServiceAt }
```

```text
Notifications deliver; journey registry may orchestrate but RecallRule is operational SoR.
```

Freeze core contract summary:

```text
Recall | RecallRule + PatientRecallInstance
```

---

## P1 items assigned to Wave G

From Architecture Freeze P1 register (none silently deferred):

| ID | Title (verbatim) | Wave G? |
|----|------------------|---------|
| **P1-10** | Waitlist auto-fill | **YES** |
| **P1-11** | Holiday/leave availability | **YES** |
| **P1-13** | Operational Recall SoR / professional recall workflow | **YES** |

### P1-10 — Waitlist auto-fill (bound)

Freeze core contract:

```text
Waitlist | Offer/TTL/accept; no silent auto-book without policy
```

Target Domain Architecture §17:

```text
on Appointment CANCELLED → select OPEN waitlist candidates by rules
→ offer with TTL (notify)
→ first valid accept wins under concurrency locks
→ timeout expires offer
```

```text
Default: no auto-book without tenant policy flag.
```

Enterprise QA Acceptance Architecture:

| Assert | Layers |
|--------|--------|
| Waitlist auto-fill | offer/accept/timeout races under same lock model | Postgres + API |

Synchronous boundary (Target Domain §20): **accept waitlist offer** is a synchronous transaction.  
Async: **waitlist offers** (side effects).

### P1-11 — Holiday/leave availability (bound)

Domain Contract Matrix:

| Concept | Source of Record | Scope | Write Authority | Tenant Isolation | Delete Policy | Audit | Primary QA Pack | Wave |
|---------|------------------|-------|-----------------|------------------|---------------|-------|-----------------|------|
| AvailabilityException | AvailabilityException | tenant/branch | schedule.admin | tenant-scoped | soft | YES | Availability | G |

Target Domain Architecture §18:

```text
Types: PROVIDER_LEAVE, BRANCH_HOLIDAY, RESOURCE_MAINTENANCE, EXTRA_AVAILABILITY.
Precedence: exception deny > weekly open; EXTRA adds slots.
Timezone = branch/tenant policy.
```

Freeze core contract:

```text
Availability | AvailabilityException
```

Enterprise QA:

| Assert | Layers |
|--------|--------|
| Holiday/leave | AvailabilityException precedence | unit + API |

Wave D scope note (non-conflicting): operatory *maintenance SoR* is P1-11 via AvailabilityException.

### P1-13 — Operational Recall SoR (bound)

See AR-17 above. Enterprise QA:

| Assert | Layers |
|--------|--------|
| Recall | RecallRule due→book→complete; ≠ reminder only | API + notifications |

Conceptual events: `RecallDue`, `WaitlistCandidateOffered`.

---

## Authorization freeze (conceptual, Wave G relevant)

From Architecture Freeze §8:

```text
… dental.lab / outreach.admin / schedule.admin / …
```

```text
cross-tenant = DENY
```

Write owners for Wave G SoRs: **outreach.admin** (RecallRule; instances via outreach/scheduling), **schedule.admin** (AvailabilityException). Waitlist offer accept remains under scheduling permissions / concurrency model (booking integrity).

---

## Explicit OUT OF SCOPE (this wave)

Do **not** implement or reopen under Wave G kickoff/implementation without separate CTO authority:

| Out of scope | Reason |
|--------------|--------|
| Patient portal product expansion | Baseline PARTIAL; not Wave G domains |
| POS / cashbox / cash drawer SoR | Baseline PARTIAL; not Wave G |
| Wave H (Arabic search / RTL / tablet a11y closure) | Separate wave; P1-08 / P1-12 |
| Wave I (enterprise QA closure onepass) | After A–H |
| Phase 49 / Step 30 | Freeze: NOT AUTHORIZED |
| Payroll engine | Commission freeze: payroll = NO; Wave F closed |
| Wave F workforce commercials changes | CLOSED (PR #1 / 3F) |
| Dermatology EMR entity | AR-15 frozen elsewhere; not G |
| Silent waitlist auto-book without tenant policy | Forbidden by freeze |
| Treating journey registry / appointment reminders as Recall SoR | AR-17: reminders ≠ SoR |
| Claiming existing `AppointmentWaitlist` CRUD = P1-10 done | See `WAVE_G_CURRENT_STATE_VS_EXIT.md` |

---

## Governance note

Architecture Freeze header historically said “Waves B–I NOT YET AUTHORIZED”; **CTO has now AUTHORIZED Wave G kickoff** (docs/evidence only in this package). Implementation slices still require a **subsequent** explicit implementation authority prompt.
