# Phase 48 Architecture Freeze Amendment — PA-04 PriceVersion Scheduling

```text
STATUS = ACCEPTED AND FROZEN
EXTERNAL APPROVAL = GRANTED
IMPLEMENTATION AUTHORIZED NEXT = YES
IMPLEMENTATION PERFORMED = NO

External acceptance decision:
PHASE 48 PA-04 ARCHITECTURE FREEZE AMENDMENT = ACCEPTED

Option B = ACCEPTED
CONDITION-01 = CLOSED
CONDITION-02 = CLOSED
CONDITION-03 = CLOSED
CONDITION-04 = CLOSED
FA-01 = CLOSED
FA-02 = CLOSED
FA-03 = CLOSED
FC-01 = CLOSED
FC-02 = CLOSED
Remaining architecture ambiguity count = 0
```

| Field | Value |
|-------|--------|
| **ACR** | `docs/PHASE_48_WAVE_A_PA04_ARCHITECTURE_CHANGE_REQUEST.md` |
| **Analysis** | `docs/PHASE_48_WAVE_A_PA04_ARCHITECTURE_CONFORMANCE_ANALYSIS.md` |
| **Selected option** | OPTION B — SCHEDULED + due-activation gate + FA/FC terminal & interval rules |
| **SSOT promotion** | Promoted into `docs/PHASE_48_ARCHITECTURE_FREEZE.md` AR-04 |
| **Further semantic change** | Requires new ACR + external approval + freeze amendment |

This document is the accepted amendment text. Normative contract below is **FROZEN**.
PA-04 Production Acceptance is **not** claimed by this promotion.

## Final Option B normative contract

```text
DRAFT
  mutable unpublished
  0 effective history

SCHEDULED
  published immutable future commitment
  may have finite effectiveTo
  never live before reconciliation
  may be canceled before first activation
  due reconciliation required before successful live resolution
  canceled-before-effective excluded from effective timeline

ACTIVE
  persisted cardinality per commercial key = 0..1 (at most one)
  only valid live when evaluationTime is inside its commercial interval
  immutable commercial fields

SUPERSEDED
  was effective; no longer current
  ended because a successor commercial boundary (next effectiveTimelineMember.effectiveFrom) took over
  effective-timeline member for its commercial interval

INACTIVE-never-effective
  withdrawn/canceled before first effective entry (e.g. SCHEDULED→INACTIVE cancel)
  audit-visible; NOT effective-history member
  (semantic subclass of INACTIVE; no new enum value)

INACTIVE-after-effective
  was historically effective; ended WITHOUT successor takeover
  includes: explicit effectiveTo terminal expiry without successor;
            ACTIVE→INACTIVE commercial withdrawal
  effective-timeline member only for its actual commercial interval
  (semantic subclass of INACTIVE; no new enum value)
```

Commercial key (unchanged):

```text
tenantId | branchId/default | clinicalServiceId | pricingUnit | currency | serviceVariantId/default
```

AR-05 = UNCHANGED.

---

## FA-01 — ACTIVE cardinality semantics (CLOSED)

### Persistent invariant

```text
At most one ACTIVE PriceVersion may exist per commercial key.
persisted ACTIVE cardinality per commercial key = 0..1
```

Zero ACTIVE is a **legal persisted state** (no configured price, or last ACTIVE withdrawn).

### Live-resolution success invariant (separate)

```text
After due-schedule reconciliation AND expired-ACTIVE terminal reconciliation:

- 0 valid ACTIVE in commercial interval
  → no valid current price
  → deterministic no-price / FAIL CLOSED domain result
  → do NOT return historical former ACTIVE

- exactly 1 valid ACTIVE in commercial interval
  → successful live commercial resolution may return it

- >1 ACTIVE (any status ACTIVE rows for key)
  → invariant violation
  → FAIL CLOSED
  → operational alert / defect
  → no arbitrary selection
```

```text
successful live commercial price resolution
requires exactly 1 valid ACTIVE after reconciliation
AND evaluationTime inside that version's commercial interval
```

### Examples

**FA-01-A** — No price configured → ACTIVE count = 0 → live = no-price / fail closed.

**FA-01-B** — V1 ACTIVE → admin INACTIVE, no successor → ACTIVE count = 0 (legal) → live does **not** return historical V1.

**FA-01-C** — V1 ACTIVE + V2 due → reconcile succeeds → final ACTIVE count = 1.

**FA-01-D** — corrupt 2 ACTIVE → live refuses arbitrary selection → FAIL CLOSED + alert.

```text
FA-01 = CLOSED
```

---

## FA-02 — ACTIVE→INACTIVE historical commercial end (CLOSED)

### Immutability

```text
Do NOT rewrite published effectiveTo on ACTIVE→INACTIVE.
```

### Commercial withdrawal boundary

```text
inactivationEffectiveAt
= immutable lifecycle/audit transition evidence for ACTIVE→INACTIVE
= commercial withdrawal boundary for historical reconstruction

Normative field mapping for Wave A:
  inactivatedAt (existing lifecycle metadata)
  IS the commercial withdrawal boundary for ACTIVE→INACTIVE
  when the transition is ACTIVE → INACTIVE.

activatedAt / supersededAt are operational evidence and are NOT
automatic commercial boundaries (unless superseded via successor
effectiveFrom rule below).
```

### Timestamp meanings (complete)

| Timestamp | Role |
|-----------|------|
| **effectiveFrom** | Authoritative commercial **start** |
| **effectiveTo** | Optional immutable terminal bound set/known at publish |
| **inactivatedAt** (ACTIVE→INACTIVE) | Authoritative commercial **withdrawal** end for that version |
| activatedAt | Operational activation evidence — not a commercial boundary |
| supersededAt | Operational supersession evidence — not a commercial boundary |
| publishedAt | Operational publish evidence |

### Historical end formula (normative)

For each `effectiveTimelineMember` V:

```text
commercialStart(V) = effectiveFrom

Applicable commercial end boundaries (only if valid):
  B1 = explicit effectiveTo, if present
  B2 = next effectiveTimelineMember.effectiveFrom, if a successor exists
       (successor must be an effectiveTimelineMember; canceled-never-effective NEVER contributes)
  B3 = inactivatedAt commercial withdrawal boundary, if V underwent ACTIVE→INACTIVE

commercialEnd(V) = earliest applicable boundary among {B1, B2, B3}

If no applicable boundary:
  commercialEnd(V) = ∞  ONLY if V is still ACTIVE

Required:
  for a valid effective interval: commercialEnd(V) > commercialStart(V)
  derivedEnd / commercialEnd(V) never exceeds explicit effectiveTo when B1 present
    (i.e. commercialEnd = min of applicable bounds already enforces this)
```

Precedence is **earliest applicable**, not “pick one arbitrarily.”
Publication-time validation (FA-03) prevents impossible overlapping configurations.

### Behavior examples

**FA-02-A** — V1 ACTIVE from T0 → INACTIVE at T3, no successor:

```text
[T0, T3) = V1
T >= T3 = no effective price
```

**FA-02-B** — V1 ACTIVE, V2 successor effectiveFrom=T2, V1 superseded during reconcile:

```text
historical end of V1 = T2 (= B2)
NOT supersededAt, even if supersededAt > T2
```

**FA-02-C** — V1 explicit effectiveTo=T5, admin ACTIVE→INACTIVE at T6:

```text
commercialEnd = min(T5, T6) = T5
transition does not extend the interval past T5
(V1 already commercially ended at T5; inactivation is lifecycle cleanup)
```

**FA-02-D** — V1 inactivated at T3, V2 starts T4:

```text
[start, T3) = V1
[T3, T4) = deliberate gap (no effective price)
T4+ = V2 after valid activation
Do NOT stretch V1 to T4.
```

```text
FA-02 = CLOSED
published effectiveTo mutated = NO
withdrawn ACTIVE historical end deterministic = YES
```

---

## FA-03 — Explicit effectiveTo / expired schedule semantics (CLOSED)

### Rule A — Publish-time range validity

```text
If effectiveTo is present: effectiveTo > effectiveFrom  (mandatory)
```

### Rule B — No conflicting effective timeline

```text
Predecessor-side constraint (still required):
  if predecessor has explicit effectiveTo = TpEnd
  and candidate.effectiveFrom < TpEnd
  → REJECT
  do NOT mutate predecessor effectiveTo

Contiguous boundary is VALID:
  predecessor.effectiveTo = T
  successor.effectiveFrom = T

FULL bidirectional / insertion-order-independent validation = FC-02
(validates against ALL relevant published intervals / nearest neighbors).
```

### Rule C — Expired-before-activation SCHEDULED (refined by FC-01)

```text
V2 SCHEDULED [T2, T3), reconcile at T4 >= T3:

V2 MUST NOT become current/live ACTIVE at T4.

Catch-up under commercial-key lock (same transaction):
  - V2 materializes as effectiveTimelineMember for [T2, T3)
  - Terminal lifecycle classification (FC-01):
      IF a next effectiveTimelineMember exists with effectiveFrom == T3
        → V2 ends by successor takeover → SUPERSEDED
      ELSE (no successor; explicit finite end closed the interval)
        → V2 ends without successor → INACTIVE-after-effective
  - never externally exposed as live ACTIVE after T3
```

### Rule D — Current ACTIVE explicit expiry

```text
If ACTIVE has effectiveTo = T5 and evaluationTime >= T5:
  it is NOT a valid successful live price
  even if status is still ACTIVE pending reconciliation.

Commercial resolution MUST:
  reconcile terminal state / successor if available
  OR fail closed / no-price

Never return an ACTIVE row outside:
  effectiveFrom <= evaluationTime < effectiveTo
when effectiveTo is non-null.

Terminal lifecycle after reconcile (FC-01):
  if next effectiveTimelineMember starts at commercialEnd → SUPERSEDED
  if no successor → INACTIVE-after-effective
```

### Rule E — Derived end never exceeds explicit end

```text
commercialEnd(V) = earliest applicable of {B1, B2, B3}
⇒ commercialEnd(V) <= explicit effectiveTo whenever B1 exists
```

### Examples

**FA-03-A** — V1 [T0,T10), attempt V2@T5 → REJECT; V1 unchanged.

**FA-03-B** — V1 ends T10, V2 starts T10 → VALID contiguous; V1 terminal = SUPERSEDED.

**FA-03-C** — V1 ACTIVE; V2 SCHEDULED [T2,T3); reconcile T4>T3; no later successor:

```text
V2 never live at T4
V2 effectiveTimelineMember [T2,T3)
V2 terminal lifecycle = INACTIVE-after-effective  (FC-01 non-successor terminal)
```

**FA-03-D** — V1 ACTIVE [T0,T5), request T6, no successor → V1 not returned; no-price/fail-closed; terminal reconcile → INACTIVE-after-effective (not SUPERSEDED).

**FA-03-E** — V2[T2,T3) V3[T3,T4) V4[T4,∞) catch-up T5:

```text
historical: T2..T3=V2; T3..T4=V3; T4+=V4
V2,V3 terminal = SUPERSEDED (successor-driven)
final live: V4 ACTIVE
V2/V3 never externally exposed live during catch-up
```

```text
FA-03 = CLOSED (refined by FC-01/FC-02; no redesign)
explicit-range overlap publication = REJECTED
expired SCHEDULED live = NO
expired ACTIVE live = NO
finite-window multi-due catch-up deterministic = YES
```

---

## FC-01 — Terminal lifecycle semantics for explicit effectiveTo expiry (CLOSED)

### Compact normative rule

```text
commercial interval end (WHEN) and lifecycle terminal reason (WHY/HOW) are distinct.

- successor boundary closes interval
  → terminal lifecycle SUPERSEDED

- explicit effectiveTo closes interval without successor
  → terminal lifecycle INACTIVE-after-effective

- ACTIVE→INACTIVE withdrawal closes interval
  → terminal lifecycle INACTIVE-after-effective

- canceled-before-effective
  → INACTIVE-never-effective

Tie / cause priority when explicit effectiveTo == next successor.effectiveFrom:
  → SUPERSEDED (successor takeover is the effective timeline transition)

When explicit effectiveTo is earlier than next successor.effectiveFrom:
  → INACTIVE-after-effective at explicit effectiveTo
  → deliberate gap until successor.effectiveFrom
```

commercialEnd formula is unchanged (earliest of B1/B2/B3). Status does not rewrite immutable historical boundaries.

### Classification examples

| Case | Result |
|------|--------|
| FC-01-A V1 ends because V2 starts T2 | V1 = SUPERSEDED |
| FC-01-B V1 ACTIVE [T0,T5), no successor, reconcile ≥T5 | V1 = INACTIVE-after-effective; not live |
| FC-01-C V2 SCHEDULED [T2,T3), catch-up after T3, no successor | materialize [T2,T3); terminal = INACTIVE-after-effective |
| FC-01-D V2 [T2,T3), V3 starts T3 | V2 = SUPERSEDED |
| FC-01-E V1 [T0,T10), admin inactivates T5 | commercialEnd=T5; terminal = INACTIVE-after-effective |

```text
FC-01 = CLOSED
explicit expiry without successor terminal = INACTIVE-after-effective
successor-driven end terminal = SUPERSEDED
```

---

## FC-02 — Bidirectional / insertion-order-independent interval validation (CLOSED)

### Invariant

```text
Published immutable commercial intervals on commercial key K are non-overlapping
regardless of insertion order.

Candidate C's proposed immutable commercial interval must not overlap ANY
already-published immutable explicit interval on K (excluding canceled-never-effective).
```

### Overlap definition

```text
C = [C.effectiveFrom, C.effectiveTo_or_∞)
P = [P.effectiveFrom, P.effectiveTo_or_∞)   # for EXPLICIT-interval members:
                                             # open-ended P uses ∞ only for EXPLICIT
                                             # overlap checks against other EXPLICIT ends;
                                             # see EXPLICIT vs DERIVED distinction below

overlap iff:
  C.start < P.end_or_infinity
  AND
  P.start < C.end_or_infinity

If overlap → REJECT (no mutation of either version)
```

### EXPLICIT vs DERIVED coexistence

```text
EXPLICIT interval overlap validation
  protects immutable effectiveTo ranges and finite published windows.

DERIVED successor boundary semantics
  allow open-ended predecessor (effectiveTo=null) to be historically ended by a later
  valid effectiveTimelineMember.effectiveFrom WITHOUT mutating P.
  Therefore open-ended predecessor does NOT automatically block every future successor.

Open-ended candidate (effectiveTo=null) BEFORE an already-published future successor:
  derived commercial end = nextPublished.effectiveFrom
  ALLOWED when nearest-neighbor / all-interval checks pass (no explicit conflict).

Open-ended candidate that would require crossing an already-published finite successor
  or conflicting explicit terminal → REJECT.
  Do NOT silently derive/mutate candidate.effectiveTo after publish.
```

### Nearest-neighbor validation (mathematically sufficient when ordered by effectiveFrom)

Among **non-canceled** published schedule members on K (SCHEDULED|ACTIVE|SUPERSEDED|INACTIVE-after-effective that still define published schedule boundaries; canceled-never-effective EXCLUDED from overlap blockers):

```text
previousPublished = greatest effectiveFrom < candidate.effectiveFrom
nextPublished     = smallest effectiveFrom > candidate.effectiveFrom

1. candidate.effectiveFrom != any published effectiveFrom
   (uncontrolled duplicate → REJECT; controlled replace under lock only)

2. if previousPublished.explicit effectiveTo exists:
     require candidate.effectiveFrom >= previousPublished.effectiveTo
     else REJECT

3. if candidate.explicit effectiveTo exists and nextPublished exists:
     require candidate.effectiveTo <= nextPublished.effectiveFrom
     else REJECT

4. if candidate.effectiveTo is null and nextPublished exists:
     derived end = nextPublished.effectiveFrom (valid open-ended insertion)
     ALLOWED (no silent mutate of effectiveTo)

5. canceled-never-effective:
     excluded from effective-timeline overlap blockers
     audit identity retained
     same effectiveFrom may be reused ONLY via controlled replace under commercial-key lock
```

Equivalently: validate candidate against **all** relevant published intervals — same invariant.

### Examples

| Case | Result |
|------|--------|
| FC-02-A V1[T0,T10) + V2[T5,T15) | REJECT |
| FC-02-B V1[T0,T10) V3[T20,T30) + V2[T15,T25) | REJECT (successor-side) |
| FC-02-C V1[T0,T10) V3[T20,T30) + V2[T10,T20) | VALID |
| FC-02-D V3@T20 + V2@T10 effectiveTo=null | VALID; derived end = T20 |
| FC-02-E V3@T20 + V2[T10,T25) | REJECT |
| FC-02-F duplicate effectiveFrom uncontrolled | REJECT |
| FC-02-G canceled V2@T20 + replace V2b@T20 under lock | ALLOWED controlled replace |

```text
FC-02 = CLOSED
successor-side overlap rejected = YES
candidate validated against predecessor = YES
candidate validated against successor = YES
duplicate effectiveFrom uncontrolled publish = REJECTED
controlled replacement same boundary = ALLOWED UNDER LOCK
```

---

## Historical derivation (complete normative formula)

```text
effectiveTimelineMember(V) = TRUE iff V successfully entered ACTIVE at least once
  (including catch-up materialization that records activation evidence then terminalizes)
  AND not canceled-never-effective

commercialStart(V) = effectiveFrom

B1 = explicit effectiveTo if present
B2 = next effectiveTimelineMember.effectiveFrom if present
B3 = inactivatedAt if ACTIVE→INACTIVE withdrawal occurred

commercialEnd(V) = earliest applicable among {B1,B2,B3}
                 or ∞ iff V still ACTIVE and none apply

Properties:
  no overlap between effectiveTimelineMembers (enforced by publish rules + catch-up)
  gaps allowed when deliberately created (e.g. inactivation then later successor)
  canceled-never-effective does NOT contribute B2
  activationAt is NOT a commercial boundary
  supersededAt is NOT a commercial boundary
```

---

## Live resolution contract (updated)

```text
resolveCurrentCommercialPrice(K, evaluationTime):

1. validate commercial key / tenant / branch
2. reconcile all due SCHEDULED boundaries (CONDITION-01 / CONDITION-04 / FA-03)
3. reconcile any expired ACTIVE terminal boundary (FA-03 Rule D)
4. fresh re-read
5. candidate ACTIVE must satisfy:
     status = ACTIVE
     AND effectiveFrom <= evaluationTime
     AND (effectiveTo IS NULL OR evaluationTime < effectiveTo)
6. exactly one valid ACTIVE → success
7. zero valid ACTIVE → deterministic no-price / FAIL CLOSED
8. multiple ACTIVE rows OR multiple valid ACTIVE → invariant violation / FAIL CLOSED + alert
```

```text
ACTIVE status alone is NOT sufficient for live success.
```

---

## Multi-due reconciliation (updated)

Under one commercial-key lock / transaction:

```text
due/expired schedule set evaluated against configured timeline at evaluationTime T

For each due SCHEDULED Vi ordered by effectiveFrom ASC:
  materialize only valid commercial interval [commercialStart, commercialEnd)
  if Vi's commercial interval contains T and is the unique covering interval:
    Vi becomes the sole final ACTIVE
  if Vi's commercial interval ended before T (expired-before-current):
    materialize as effectiveTimelineMember in-txn
    terminal lifecycle per FC-01:
      successor at commercialEnd → SUPERSEDED
      else → INACTIVE-after-effective
    NEVER expose as live ACTIVE after commercialEnd
  never expose intermediate versions live outside the transaction

final ACTIVE =
  the version whose configured commercial interval contains T
  NOT blindly "latest due" if that latest interval has already expired

if no interval contains T:
  final ACTIVE may be none (0 ACTIVE legal)
  persist/audit terminal states deterministically
```

---

## Conditions 01–04 (still CLOSED; summary)

Unchanged in intent from prior package:

- CONDITION-01 due-activation gate; stale predecessor success FORBIDDEN  
- CONDITION-02 effectiveFrom sole authoritative start boundary  
- CONDITION-03 canceled-never-effective excluded from effective history  
- CONDITION-04 atomic multi-due catch-up; no intermediate live exposure  

Live resolver steps above incorporate FA-01/02/03 refinements.

---

## Final amendment acceptance counters

```text
CONDITION-01 = CLOSED
CONDITION-02 = CLOSED
CONDITION-03 = CLOSED
CONDITION-04 = CLOSED

FA-01 ACTIVE cardinality semantics = CLOSED
FA-02 ACTIVE→INACTIVE historical end = CLOSED
FA-03 explicit effectiveTo / expired schedule semantics = CLOSED

FC-01 terminal lifecycle semantics = CLOSED
FC-02 insertion-order-independent interval validation = CLOSED

explicit expiry without successor terminal = INACTIVE-after-effective
successor-driven end terminal = SUPERSEDED
explicit expiry before successor gap = YES (INACTIVE-after-effective then gap)
successor-side overlap rejected = YES
candidate interval validated against predecessor = YES
candidate interval validated against successor = YES
duplicate effectiveFrom uncontrolled publish = REJECTED
controlled replacement same boundary = ALLOWED UNDER LOCK

persisted ACTIVE cardinality = 0..1
successful live ACTIVE cardinality = exactly 1
ACTIVE outside explicit effectiveTo returned live = NO
canceled-never-effective contributes derivedEnd = NO
withdrawn ACTIVE historical end deterministic = YES
expired SCHEDULED returned live = NO
explicit-range overlap publication allowed = NO
finite-window multi-due catch-up deterministic = YES

remaining architecture ambiguity count = 0
implementation authorization = NO

Freeze Amendment status = ACCEPTED AND FROZEN
external approval = GRANTED
implementation authorization next = YES
implementation performed = NO
```

Do **not** claim PA-04 Production Acceptance from this amendment alone.
Further changes to PriceVersion lifecycle / commercial interval / terminal classification /
due activation / historical derivation / commercial key / concurrency / interval validation
require a **new** Architecture Change Request + external approval + freeze amendment.

---

## Migration analysis (unchanged disposition)

```text
20260814150000 migration disposition = KEEP AS-IS (after final amendment acceptance)
production DB touched = NO
destructive migration proposed = NO
Provisional SCHEDULED implementation = NOT ACCEPTED / UNTOUCHED
```
