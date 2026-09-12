# Wave I Frozen Scope Extract

Kickoff package only — **not** an implementation or Production Acceptance claim.

**Canonical base:** `release47-step22-transfer-20260810-0353` @ `d53ff77a0ba4e0c0edac6f3f259922fea2b1caf3`  
**Wave H / PR #3:** ACCEPTED (merged) — do not reopen SoR.  
**Waves F / G:** CLOSED — do not reopen.

## Source authority (SSOT)

| Document | Binding use |
|----------|-------------|
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | **AR-19**; AR-18 migration; full ADR matrix |
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Wave I table + **frozen pack names** + exit |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | §12 CI/onepass; §13 Wave I closure |
| Wave A–H review packages | Prior pack proofs (precursors ≠ I exit) |

Exact CI job names may evolve; **pack semantics and AR-19 framework reuse are frozen**.

---

## Official Wave I name

**Enterprise QA Closure**

## Frozen Wave I table (verbatim-bound)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`:

| Item | Value |
|------|-------|
| P0/P1 | All P0/P1 |
| ADRs | AR-19 |
| Domains | Full pack matrix + migration validators + regression/onepass |
| QA | All frozen packs below |
| Entry | Waves A–H deliverables present |
| Exit | All P0 packs green; P1 packs green; combined traceability; Release 47 gates remain green |

---

## AR-19 (bound)

From Architecture Freeze ADR matrix:

| ADR | Decision | Authoritative SoR | Scope | Write owner | Historical rule | Tenant rule | QA pack | Wave | Status |
|-----|----------|-------------------|-------|-------------|-----------------|-------------|---------|------|--------|
| AR-19 | Jest/DB/onepass QA packs | QA architecture | — | engineering | deterministic | — | clean/upgrade validators | all packs | I | **FROZEN** |

Framework reuse (frozen — `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`):

```text
Jest unit/integration
Postgres DB validators
existing CI philosophy
deterministic --runInBand / onepass patterns
```

```text
Do not invent a second test framework without Freeze amendment.
```

Enterprise QA Acceptance Architecture §12 / preamble: reuse Jest, Postgres DB validators, CI workflows, and onepass philosophy — **do not** introduce a second test framework.

---

## Frozen QA packs (verbatim)

### P0

```text
P0 Catalog Integrity Pack = FROZEN
P0 Pricing / Snapshot Pack = FROZEN
P0 Scheduling Concurrency Pack = FROZEN
P0 Provider Eligibility Pack = FROZEN
P0 Consent Pack = FROZEN
P0 Injectable Traceability Pack = FROZEN
P0 Treatment Plan Link Pack = FROZEN
P0-10 Inventory Accountability Pack = FROZEN
```

### P1

```text
P1 Operatory Pack = FROZEN
P1 Course Scheduling Pack = FROZEN
P1 Device/Laser Pack = FROZEN
P1 Dermatology Pack = FROZEN
P1 Dental Lab Pack = FROZEN
P1 Arabic/RTL Pack = FROZEN
P1 Pre/Post Care Pack = FROZEN
P1 Waitlist Pack = FROZEN
P1 Availability Pack = FROZEN
P1 Accessibility/Tablet Pack = FROZEN
P1 Recall Pack = FROZEN
P1-14 Commission Pack = FROZEN
```

### Cross-cutting

```text
Combined Traceability Pack = FROZEN
Migration Clean/Upgrade Packs = FROZEN
Regression / onepass closure = FROZEN
```

---

## Wave I closure criteria (bound — §13)

From `PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` §13:

```text
all P0 packs green including P0-10
P1 packs green including P1-14
combined traceability pack green
Release 47 Step 28/29 gates remain green as regression baselines
flaky tests quarantined with deterministic fix — not silenced
```

§12 CI / onepass (future — wire in Wave I, do not claim done at I0):

```text
test:phase48-p0-concurrency
test:phase48-p0-snapshot-pricing
test:phase48-p0-catalog
test:phase48-p0-eligibility
…
```

---

## Explicit OUT

| OUT | Why |
|-----|-----|
| Phase 49 / Step 30 | Separate program |
| Phase 50 polish dump | Visual polish ≠ Wave I |
| Phase 51 | Not in Phase 48 Wave I |
| New product / schema SoR | Waves A–H closed; I is QA closure |
| Second test framework (Vitest-as-API-pack, Playwright-as-API SoR, new runner brand) | Violates AR-19 |
| Reopening Wave F/G/H SoR | Closed without new product failure + CTO |
| Self-granted Wave I Production Acceptance | External / CTO only |

---

## Entry gates (for later implementation)

- Canonical tip includes Wave H merge `d53ff77` (or later accepted).
- Waves A–H deliverables present.
- Explicit CTO **implementation** authority for I1+ (I0 kickoff alone is insufficient).
- Wave F/G/H SoR remain closed.
