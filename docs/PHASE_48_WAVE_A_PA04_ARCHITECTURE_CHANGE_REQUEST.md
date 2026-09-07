# Phase 48 Wave A — PA-04 Architecture Change Request

| Field | Value |
|-------|--------|
| **Document** | Architecture Change Request (ACR) |
| **Status** | **ACCEPTED** |
| **Selected Option** | B |
| **Freeze Amendment** | **ACCEPTED AND FROZEN** |
| **Implementation** | **AUTHORIZED NEXT** |
| **Implementation performed** | NO |
| **Related analysis** | `docs/PHASE_48_WAVE_A_PA04_ARCHITECTURE_CONFORMANCE_ANALYSIS.md` |
| **Freeze amendment** | `docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md` |

## Problem statement

Frozen AR-04 requires simultaneously:

- append-only published commercial history
- open-ended current ACTIVE prices (`effectiveTo = null`)
- future-effective pricing
- no early commercial gap
- no overlapping ACTIVE ranges

The four frozen statuses alone cannot satisfy all of these (see conformance analysis).
The provisional uncommitted `SCHEDULED` implementation is an **architecture semantic change**
and is **not accepted** without Freeze Amendment.

## Decision criteria

```text
frozen intent preservation
commercial correctness
future-effective pricing
append-only auditability
no ambiguous overlap
tenant/branch pricing correctness
concurrency safety
historical determinism
operational simplicity
maintainability
testability
migration safety
global SaaS quality
minimum architecture expansion
```

---

## OPTION A — Strict frozen contract / no future published scheduling

### Semantics

```text
Future candidate remains DRAFT until its effective boundary.
At boundary (job or operator):
  acquire commercial-key advisory lock
  current ACTIVE → SUPERSEDED (lifecycle only)
  future DRAFT → ACTIVE
```

### Evaluation

| Dimension | Assessment |
|-----------|------------|
| Append-only commercial fields | PASS for published rows |
| ACTIVE overlap | PASS if activation is atomic under lock |
| Automation requirement | HIGH — missed activation = wrong commercial price |
| Manual/operator risk | HIGH |
| Future price visibility | DRAFT only — weak for audit/commercial commitment |
| Commercial usability | FAIL for published future price lists |
| Auditability | Weak — drafts are mutable until activation |
| Historical lookup | Needs SUPERSEDED open-ended historical rule |
| Global-competitive suitability | FAIL for ERP-grade scheduled pricing |
| Wave A acceptance impact | Would claim “no freeze change” but fails R3 published future pricing |

### Frozen changes required

```text
None to enum — but business capability for published future prices is absent.
```

### Recommendation

```text
REJECTED
```

Does not meet healthcare SaaS need for immutable, published, future-effective commercial prices.

---

## OPTION B — Add first-class SCHEDULED lifecycle (APPROVED DIRECTION)

### Status

```text
Option B direction = APPROVED
Normative detail = Freeze Amendment PA-04 (Conditions 01–04 + FA-01/02/03 CLOSED in proposal)
Provisional worktree code = NOT ACCEPTED
```

### Semantics (target — NOT the provisional code as-is)

```text
DRAFT | SCHEDULED | ACTIVE | SUPERSEDED | INACTIVE
```

Normative rules are owned by
`docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md`.
Summary (must not contradict the amendment):

| Topic | Contract |
|-------|----------|
| SCHEDULED | published, immutable, not live-current; may have finite effectiveTo |
| ACTIVE persisted | **at most one** per commercial key (0..1 legal) |
| Live success | exactly **1** valid ACTIVE **in commercial interval** after due/terminal reconcile |
| Live resolution | due SCHEDULED + expired ACTIVE reconcile under commercial-key lock; interval-validated ACTIVE |
| Stale / expired success | **FORBIDDEN** |
| Authoritative start | **effectiveFrom** |
| Withdrawal end | **inactivatedAt** for ACTIVE→INACTIVE (no effectiveTo mutation) |
| commercialEnd | earliest of {explicit effectiveTo, next timeline member From, inactivatedAt} |
| Terminal WHY | successor → SUPERSEDED; non-successor expiry/withdrawal → INACTIVE-after-effective (FC-01) |
| Interval validation | bidirectional predecessor+successor; insertion-order independent (FC-02) |
| Canceled-before-effective | audit-visible; not timeline member; no overlap blocker; replace under lock only |
| Multi-due catch-up | atomic; final ACTIVE = covering interval at T |
| Background activator | proactive only |
| On-demand reconciliation | correctness guarantee |

### Evaluation

| Dimension | Assessment |
|-----------|------------|
| Append-only | PASS |
| Future published pricing | PASS |
| No early gap before boundary | PASS (prior ACTIVE until effectiveFrom) |
| No stale success after boundary | PASS (CONDITION-01 gate) |
| ACTIVE overlap | PASS |
| Historical/live alignment | PASS (CONDITION-02/03/04) |
| Architecture expansion | Minimal (+1 status + activator + read gate) |
| Wave A impact | Final Freeze Amendment external acceptance still required |

### Frozen changes required

```text
YES — PriceVersion status enum + AR-04 scheduling/activation/historical/due-gate text
```

### Recommendation

```text
SELECTED (APPROVED DIRECTION)
```

---

## OPTION C — Immutable effectiveFrom sequence (derived effectiveTo)

### Semantics

```text
Published versions are immutable ordered points on the commercial key.
Stored effectiveTo is optional/terminal-only OR always derived.
Live effective price = latest published point with effectiveFrom <= T
  among published schedule membership.
```

### Evaluation

| Dimension | Assessment |
|-----------|------------|
| Append-only | Excellent |
| Future pricing | Needs either DRAFT-until-boundary or a published-not-yet-live state (reintroduces SCHEDULED/PUBLISHED distinction) |
| Overlap semantics | Must rewrite AR-04 “ACTIVE range overlap” into “published point uniqueness / derived intervals” |
| DB constraints | Different exclusion model |
| Expansion | Larger semantic rewrite than +SCHEDULED |
| Clarity | High long-term elegance |

### Frozen changes required

```text
YES — substantial AR-04 rewrite (ACTIVE meaning, overlap, effectiveTo)
```

### Recommendation

```text
REJECTED for Wave A
```

Preferable as a future evolution only if SCHEDULED+activation proves insufficient.
Too large a semantic rewrite for the current Production Acceptance gate.

---

## OPTION D — Separate immutable PriceActivationSchedule construct

### Semantics (conceptual only)

```text
PriceVersion lifecycle stays DRAFT|ACTIVE|SUPERSEDED|INACTIVE
+ separate CommercialEffectiveSchedule / PriceActivationSchedule rows
  binding versionId → effectiveFrom/To / schedule status
```

### Evaluation

| Dimension | Assessment |
|-----------|------------|
| Immutability / scheduling separation | Clean |
| Non-overlap / activation / audit | Can be strong |
| Architecture expansion | HIGH — second construct beside PriceVersion |
| Wave A suitability | Excessive for foundation wave |
| Risk | Dual SoR confusion unless extremely carefully bounded |

### Frozen changes required

```text
YES — new entity in Target Domain Architecture
```

### Recommendation

```text
REJECTED for Wave A
```

Keep as future option if schedule orchestration outgrows status-on-version.

---

## OPTION E — Other repository patterns

Reviewed related patterns: AR-05 snapshot revisions (appointment commercial freeze),
AR-06 advisory locks, commission plan versioning (append-only versions).

None provides an existing **PriceVersion future-schedule** SoR without either
mutating published ranges or adding lifecycle/schedule semantics.

Inventing a second competing pricing SoR is forbidden.

### Recommendation

```text
REJECTED — no superior existing in-repo pricing schedule SoR
```

---

## Selected architecture

```text
selected option = OPTION B (SCHEDULED + mandatory activation + due-activation gate)
```

### Why chosen

- Preserves frozen append-only commercial history (R1)
- Preserves open-ended current ACTIVE (R2)
- Enables published future prices (R3)
- Avoids early gap **before** effectiveFrom; forbids stale success **after** due boundary (R4 + CONDITION-01)
- Preserves literal ACTIVE non-overlap (R5)
- Extends proven commercial-key advisory lock pattern to publish/cancel/activate/reconcile (R6)
- Aligns historical effective-at-T with effectiveFrom boundary; excludes canceled-never-effective (R7 + CONDITION-02/03/04)
- Leaves commercial key unchanged (R8)
- Minimum expansion (+1 status + activator + on-demand gate) vs Options C/D
- Fixes provisional implementation defects instead of rubber-stamping them

### Why others rejected

| Option | Why rejected |
|--------|--------------|
| A | No published immutable future price; operational risk |
| C | Larger AR-04 semantic rewrite than needed for Wave A |
| D | Excess entity surface for Wave A |
| E | No existing superior SoR |

### What frozen text must change

- PriceVersion status enum includes SCHEDULED
- AR-04 gains future publication + activation contract
- Live lookup = ACTIVE only
- Historical effective-at-T derivation rule
- Concurrency: schedule/cancel/activate under same commercial-key lock

### What does NOT change

- Commercial identity tuple (PA-07)
- Branch override → tenant default → fail closed
- AR-05 appointment snapshots / invoice reconstruction
- Append-only commercial field immutability
- Deactivate ≠ hard delete
- No second pricing SoR

### Impact summary

| Area | Impact |
|------|--------|
| Migration | Keep additive `SCHEDULED` enum migration after approval; fix behavior in app/activator |
| API | Publish future → SCHEDULED; list/filter SCHEDULED; activate system path; cancel scheduled |
| UI | Show scheduled future prices; distinguish from ACTIVE; cancel/replace flows |
| QA | Replace “lookup includes SCHEDULED” tests with activation + ACTIVE-only live lookup tests |
| Rollback | If unapproved: do not ship SCHEDULED behavior; migration additive and idle if unused |

## Implementation authorization

```text
IMPLEMENTATION AUTHORIZED = YES — NEXT TASK
IMPLEMENTATION PERFORMED = NO
Option B = ACCEPTED AND FROZEN
Conditions 01–04 = CLOSED
FA-01 / FA-02 / FA-03 = CLOSED
FC-01 / FC-02 = CLOSED
Remaining architecture ambiguity count = 0
Provisional worktree SCHEDULED code = NOT ACCEPTED until realigned to accepted amendment
```
