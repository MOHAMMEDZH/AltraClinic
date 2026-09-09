# Phase 48 Wave G — External Production Acceptance Precheck

| Field | Value |
|-------|--------|
| **Branch** | `cursor/phase48-wave-g-engagement` |
| **Evidence SHA** | `22b3b5d000c0ca911a30cf8741ff293e5039e3ab` |
| **Local pack evidence** | `apps/api/.ci-evidence/wave-g5-packs-22b3b5d/` (uncommitted) |
| **Review package** | `docs/PHASE_48_WAVE_G_IMPLEMENTATION_REVIEW_PACKAGE/` |

Checklist derived from `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/WAVE_G_ACCEPTANCE_CRITERIA.md`.  
Statuses: **PASS** = proven locally on this SHA; **PENDING** = external/CI/CTO; **N/A** = out of slice.

---

## 0. Entry gates

| Item | Status |
|------|--------|
| Canonical base includes Wave F merge `c202114` | **PASS** (ancestor) |
| Booking integrity foundations (Waves B+) present on lineage | **PASS** (lineage); deep re-proof **PENDING** PR CI |
| Explicit CTO implementation authority for Wave G | **PASS** (G1–G5 authorized sequentially) |
| Wave F / 3F remain closed | **PASS** |

## 1. Sources of Record

| SoR | Status |
|-----|--------|
| `RecallRule` tenant-scoped, soft delete, active flag | **PASS** (G3 packs) |
| `PatientRecallInstance` statuses DUE\|SNOOZED\|BOOKED\|COMPLETED\|OPTED_OUT | **PASS** |
| `AvailabilityException` typed + soft delete | **PASS** (G1 packs) |
| Waitlist offer/TTL path; default no silent auto-book | **PASS** (G2 packs + policy OFF) |
| Cross-tenant DENY | **PASS** (PG RLS cases) |

## 2. Behavioral acceptance

| Item | Status |
|------|--------|
| P1-13 RecallRule operational SoR; due→book→complete; reminders ≠ SoR | **PASS** |
| P1-10 cancel→offer/TTL; first accept wins; TTL expire; auto_book default OFF; races | **PASS** |
| P1-11 exception types + precedence deny>open, EXTRA adds | **PASS** |

## 3. Tenant / security

| Item | Status |
|------|--------|
| Tenant (branch where applicable) on Wave G writes | **PASS** (handlers + RLS) |
| Cross-tenant fail closed | **PASS** |
| Permissions via `api.scheduling` (no `api.outreach` seed) | **PASS** with known limitation documented |
| PHI minimized in audit | **PASS** (IDs + action metadata pattern); deep audit review **PENDING EXTERNAL** |

## 4. Tests / packs

| Pack | Status |
|------|--------|
| P1 Waitlist Pack | **PASS** 10/10 (5 unit + 5 PG) |
| P1 Availability Pack | **PASS** 9/9 (5 unit + 4 PG) |
| P1 Recall Pack | **PASS** 12/12 (7 unit + 5 PG) |
| G4 clinic UX smoke | **PASS** |
| CD / Platform DB / Super Admin / Phase 28 | **PENDING** (PR CI) |

## 5. Explicit non-goals (must NOT be required)

Portal / POS / payroll / Wave H–I / Phase 49 / derm EMR / Wave F reopen / silent auto-book — **honored**.

## 6. Exit sign-off block (for CTO / external)

```text
WAVE G PRODUCTION ACCEPTANCE = PENDING
Evidence SHA = 22b3b5d
P1-10 = PASS (local packs)
P1-11 = PASS (local packs)
P1-13 / AR-17 = PASS (local packs)
Waitlist Pack = PASS
Availability Pack = PASS
Recall Pack = PASS
Regressions (CD / Platform DB / Super Admin / Phase 28) = PENDING PR CI
```

---

```text
Wave G Production Acceptance = PENDING EXTERNAL REVIEW
self-granted Wave G PA = NO
```

CTO authorized docs commit + PR for gate CI; Production Acceptance remains pending greens.
