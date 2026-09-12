# Wave I — Acceptance Criteria (Production-Acceptance style)

Kickoff checklist for **future** Wave I Production Acceptance.  
**This document does not accept Wave I.** No implementation in this package.

**SSOT:** `WAVE_I_FROZEN_SCOPE_EXTRACT.md` + Architecture Freeze (AR-19) + Frozen QA Plan + Enterprise QA Acceptance Architecture §12–§13.

---

## 0. Entry gates (preconditions)

- [ ] Canonical base includes Wave H merge (`d53ff77` or later accepted tip).
- [ ] Waves A–H deliverables present on lineage.
- [ ] Explicit CTO **implementation** authority granted for Wave I (kickoff alone is insufficient).
- [ ] Wave F / G / H SoR remain closed (no reopen without new product failure).
- [ ] Framework remains Jest + Postgres validators + existing CI philosophy (AR-19) — no second test framework.

---

## 1. AR-19 / QA architecture invariants (must hold)

| Invariant | Required |
|-----------|----------|
| Jest unit/integration for API packs | YES |
| Postgres DB validators where pack requires DB | YES |
| Deterministic `--runInBand` / onepass patterns | YES |
| Clean/upgrade migration validators (AR-18) | YES |
| No second test framework without Freeze amendment | YES |
| Flaky tests quarantined with deterministic fix — not silenced | YES (§13) |

---

## 2. Behavioral / pack acceptance (§13)

### P0 packs green (including P0-10)

- [ ] P0 Catalog Integrity Pack green via named runner.
- [ ] P0 Pricing / Snapshot Pack green.
- [ ] P0 Scheduling Concurrency Pack green.
- [ ] P0 Provider Eligibility Pack green.
- [ ] P0 Consent Pack green.
- [ ] P0 Injectable Traceability Pack green.
- [ ] P0 Treatment Plan Link Pack green.
- [ ] **P0-10 Inventory Accountability Pack** green.

### P1 packs green (including P1-14)

- [ ] P1 Operatory / Course / Device/Laser / Dermatology / Dental Lab / Pre-Post Care packs green.
- [ ] P1 Waitlist / Availability / Recall packs green.
- [ ] P1 Arabic/RTL Pack green.
- [ ] P1 Accessibility/Tablet Pack green.
- [ ] **P1-14 Commission Pack** green.

### Cross-cutting

- [ ] **Combined Traceability Pack** green (first-class, not only buried round asserts).
- [ ] **Migration Clean/Upgrade Packs** green (wired validators).
- [ ] **Regression / onepass closure** green (Phase 48 matrix + Release 47 Step 28/29 baselines remain green).

---

## 3. Tenant / security / CI hygiene

- [ ] Pack runners remain tenant-scoped / fail-closed where packs assert isolation.
- [ ] Named `test:phase48-*` (or equivalent frozen script names) exist and are documented.
- [ ] CI jobs invoke pack runners (or onepass) on the accepting SHA — not ad-hoc local-only.
- [ ] Clinic Dashboard / Platform DB / Super Admin / Phase 28 gates remain green as regression baselines.

---

## 4. Explicit non-goals (acceptance must NOT require)

- Phase 49 / Step 30; Phase 50 polish dump; Phase 51.
- New product SoR / schema for closed waves.
- Second test framework.
- Reopening Wave F/G/H SoR.
- Declaring PASS because individual wave PRs once passed historically.

---

## 5. Exit sign-off block (for later CTO use)

```text
WAVE I PRODUCTION ACCEPTANCE = ________ (PENDING / ACCEPTED)
Evidence SHA = ________
All P0 packs (incl. P0-10) = ________
All P1 packs (incl. P1-14) = ________
Combined Traceability Pack = ________
Migration Clean/Upgrade Packs = ________
Regression / onepass (Phase 48 + R47 Step 28/29) = ________
AR-19 framework reuse = ________
Phase 49 / 50 polish dump = NOT REQUIRED
```

```text
self-granted Wave I PA = NO
```
