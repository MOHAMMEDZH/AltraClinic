# Phase 48 Wave A — PA-04 Post-Amendment Acceptance Test Plan

```text
STATUS = TESTS IMPLEMENTED AND EXECUTED — PENDING EXTERNAL PRODUCTION ACCEPTANCE
Freeze Amendment = ACCEPTED AND FROZEN
Implementation = AUTHORIZED AND COMPLETE
IMPLEMENTATION PERFORMED = YES
TEST IMPLEMENTATION PERFORMED = YES
TEST EXECUTED = YES
TESTS PASSED = YES (see docs/PHASE_48_WAVE_A_PA04_IMPLEMENTATION_EVIDENCE.md)
Depends on = accepted Freeze Amendment + authorized implementation delta
Option B = ACCEPTED AND FROZEN
Required cases = T1–T44
```

Define **expected persisted states**, not only lookup results.

Commercial key K = full PA-07 tuple.

## Cases

### T1 — Current price

```text
Given: V1 ACTIVE effectiveFrom=T0 effectiveTo=null
When: live lookup at now (no due SCHEDULED)
Expect persisted: V1 ACTIVE
Expect live: V1
```

### T2 — Future price publish

```text
Given: V1 ACTIVE
When: publish V2 DRAFT effectiveFrom=T2>now
Expect persisted: V1 ACTIVE unchanged commercial fields; V2 SCHEDULED
Expect live before T2: V1
Expect live does NOT return V2 while SCHEDULED and not due
```

### T3 — Multiple future prices

```text
Given: V1 ACTIVE; V2 SCHEDULED@T2; V3 SCHEDULED@T3; T2<T3
Expect: ACTIVE overlap count = 0
Expect: both remain SCHEDULED until due reconciliation
```

### T4 — Exact boundary activation (proactive or on-demand)

```text
When: reconcile at/after T2 under lock
Expect persisted: V1 SUPERSEDED (commercial fields unchanged); V2 ACTIVE
Expect live: V2
```

### T5 — Past timestamp (historical PriceVersion)

```text
After T2 activation, query effective-at T1 (T0<T1<T2)
Expect: V1 via effective-timeline derivation (not AR-05 invoice path)
```

### T6 — No early gap before boundary; no stale success after

```text
Before T2: live = V1 (no null gap)
At/after T2 with V2 due: successful live MUST be V2 after reconciliation
Stale V1 success after T2 = FORBIDDEN
If reconciliation cannot complete = FAIL CLOSED (not V1 success)
```

### T7 — Same-key concurrent publish

```text
Two futures same effectiveFrom → one success / one conflict
```

### T8 — Same-key concurrent activation/reconcile

```text
Exactly one ACTIVE transition; no dual ACTIVE; idempotent
```

### T9 — Different-key concurrency

```text
Distinct keys publish/activate concurrently → both succeed
```

### T10 — Cancel future

```text
V2 SCHEDULED → INACTIVE before activation
Expect: V1 remains ACTIVE; live V1; V2 not activatable
```

### T11 — Replace future

```text
Cancel V2 SCHEDULED; publish V2b SCHEDULED
Expect: only V2b scheduled; canceled V2 commercial immutable
```

### T12 — Branch override

```text
Branch schedule/ACTIVE independent of tenant-default overlap set
Live: branch ACTIVE override wins when present (after due gate on that key)
```

### T13 — Tenant fallback

```text
Branch has no ACTIVE; tenant ACTIVE used
Foreign branch fail-closed (PA-06 regression)
```

### T14 — Currency/unit/variant identity

```text
Different commercial dims = different keys; independent schedules
```

### T15 — Invalid transitions

```text
ACTIVE→SCHEDULED forbidden
SUPERSEDED→ACTIVE forbidden
Mutate published effectiveTo forbidden
```

### T16 — Audit

```text
Executable audit taxonomy (material transition events):
publish / schedule / activate / cancel_scheduled / supersede / inactivate

Reconciliation correctness (no separate generic "reconcile" audit event) is
exercised by T19 / T20 / T25 and related live/background race tests.
Idempotent current reads must not emit duplicate material transition audits.
```

### T17 — Migration upgrade

```text
clean + upgrade validators apply SCHEDULED enum; existing rows intact
```

### T18 — Rollback / operational scheduler-off posture

```text
No destructive down-migration required.

Operational background scheduler may be disabled.

With BACKGROUND_SCHEDULERS_ENABLED=false:
- no due schedule → current ACTIVE remains correctly resolvable;
- due SCHEDULED → live lookup still performs authoritative on-demand reconciliation;
- successful live response must return the reconciled current ACTIVE;
- stale predecessor success is forbidden;
- reconciliation failure remains fail-closed.

Background scheduler disablement is an operational latency posture only.
It does not disable SCHEDULED publishing and does not bypass the live correctness gate.
```

### T19 — Background activation delayed, live read at boundary

```text
V1 ACTIVE
V2 SCHEDULED @ T2
background activator did not run
request at T2+

Expect:
request triggers/coordinates due reconciliation
V2 becomes ACTIVE before successful price response
response = V2
stale V1 success = FORBIDDEN
```

### T20 — Reconciliation failure

```text
V2 due
activation/reconciliation cannot complete

Expect:
live price resolution FAIL CLOSED
no stale V1 success
no partial lifecycle transition
```

### T21 — Canceled never-effective schedule

```text
V1 ACTIVE
V2 SCHEDULED @ T2
cancel V2 before T2

Expect:
V2 audit-visible
V2 never effective-history member
V1 derived historical interval not truncated by V2
```

### T22 — Active then inactive history

```text
V2 activates at T2
later V2 INACTIVE

Expect:
V2 remains historical effective member
for the interval it was effective
```

### T23 — Multiple due catch-up

```text
V1 ACTIVE
V2 SCHEDULED @ T2 (open-ended or window containing T4 as appropriate)
V3 SCHEDULED @ T3
reconciliation at T4 > T3

If V3's commercial interval contains T4:
  Expect atomic final: exactly one ACTIVE = V3
  historical: T<T2=V1; T2<=T<T3=V2; T>=T3=V3

no stale successful read
no transient externally visible V2 live state during catch-up

Note: if latest due is already expired (finite window), see T35/T36 —
final ACTIVE is covering interval at T, not blindly latest due.
```

### T24 — Concurrent read-triggered reconciliation

```text
multiple commercial requests arrive when V2 is due

Expect:
same commercial-key lock
one deterministic activation/reconciliation
all successful responses use V2
no dual ACTIVE
```

### T25 — Background activator races with read-triggered reconciliation

```text
background job + live request reconcile same due schedule

Expect (deterministic persisted):
V2 = ACTIVE
predecessor V1 = SUPERSEDED (by V2)
exactly one ACTIVE for the commercial key
exactly one clinical_catalog.price.activate effective-entry audit for V2
exactly one clinical_catalog.price.supersede audit for V1
no duplicate terminal transition for V1
no duplicate activation for V2
```

### R-PA04-04 — concurrent reconcile + cancel race

```text
V2 due SCHEDULED; concurrently: live lookup, background activate, inactivate(V2)
No later successor for V2.

Expect (deterministic persisted after settle):
V2 final status = INACTIVE (INACTIVE-after-effective; isNeverEffective = false)
ACTIVE count for key = 0
exactly one V2 activate/effective-entry audit
exactly one V2 inactivate/withdraw audit
zero V2 supersede audit
exactly one V1 supersede audit
inactivate request fulfills; lookup may fail-closed if it observes post-withdraw gap
```

### T26 — Canceled V2 + later V3

```text
V1 ACTIVE
V2 SCHEDULED @ T2 canceled before T2
V3 SCHEDULED @ T3

Historical/effective:
V2 does not truncate V1
V3 becomes successor at T3
```

### T27 — Zero ACTIVE legal state

```text
no ACTIVE for K
→ live resolution no-price/fail-closed
→ no arbitrary historical fallback
```

### T28 — Two ACTIVE corruption

```text
2 ACTIVE for same K
→ live resolver invariant failure
→ no arbitrary selection
```

### T29 — ACTIVE→INACTIVE without successor

```text
V1 ACTIVE from T0
inactivate at T3
no successor

historical:
[T0,T3) = V1
T3+ = no effective price
```

### T30 — Inactivation before successor

```text
V1 ACTIVE
inactivate T3
V2 future starts T4

historical:
before T3 = V1
T3..T4 = gap
T4+ = V2 after valid activation
```

### T31 — Explicit predecessor overlap rejection

```text
V1 [T0,T10)
attempt V2 @ T5

→ reject
```

### T32 — Explicit contiguous boundary

```text
V1 ends T10
V2 starts T10

→ valid
```

### T33 — Scheduled expires before catch-up

```text
V2 [T2,T3)
reconcile after T3
no successor

→ never returned live after T3
→ deterministic historical terminal state
→ INACTIVE-after-effective (not SUPERSEDED) per FC-01
→ effectiveTimelineMember [T2,T3)
```

### T34 — ACTIVE expired with no successor

```text
V1 ACTIVE effectiveTo=T5
lookup T6

→ V1 not returned
→ no-price/fail-closed
→ terminal lifecycle after reconcile = INACTIVE-after-effective (FC-01)
```

### T35 — Finite multi-due catch-up

```text
V2 [T2,T3)
V3 [T3,T4)
V4 [T4,∞)
catch-up T5

→ V2/V3 historical only
→ V4 ACTIVE
```

### T36 — Finite latest due already expired

```text
latest due schedule interval ended before evaluationTime
no later valid schedule

→ final ACTIVE may be 0
→ no stale/expired live success
```

### T37 — Explicit expiry without successor

```text
V1 ACTIVE [T0,T5)
no successor
reconcile at T6

Expect:
commercial interval [T0,T5)
terminal lifecycle = INACTIVE-after-effective
not SUPERSEDED
```

### T38 — Successor-driven terminal classification

```text
V1 [T0,T10)
V2 starts T10

Expect:
V1 historical end T10
terminal lifecycle = SUPERSEDED
```

### T39 — Explicit end before later successor

```text
V1 [T0,T5)
V2 starts T10

Expect:
V1 → INACTIVE-after-effective at T5
gap [T5,T10)
V2 begins T10
```

### T40 — Successor-side overlap rejection

```text
V1 [T0,T10)
V3 [T20,T30)
attempt V2 [T15,T25)

Expect:
REJECT
```

### T41 — Insert between neighbors valid

```text
V1 [T0,T10)
V3 [T20,T30)
attempt V2 [T10,T20)

Expect:
VALID
```

### T42 — Open-ended insertion before future successor

```text
V3 starts T20
V2 starts T10, effectiveTo=null

Expect:
deterministic derived end = T20
no overlap
```

### T43 — Open-ended/finite crossing successor rejected

```text
V3 starts T20
attempt V2 [T10,T25)

Expect:
REJECT
```

### T44 — Controlled same-boundary replacement

```text
V2 @ T20 canceled-before-effective (published schedule)
replace with V2b @ T20 under same-key lock

Expect:
single valid schedule boundary at T20
old canceled row audit-visible
no effective-history ambiguity
```

### PA04-RPL-06 — unpublished DRAFT→INACTIVE is not a controlled-replace prior

```text
create DRAFT @ future T2
discard/inactivate while still DRAFT (publishedAt = null)
attempt replaceScheduled(prior, replacementDraft)

Expect:
REJECT
replacement remains DRAFT
prior remains INACTIVE unpublished
no schedule / cancel_scheduled events for the rejected replace
```

## Regression (must remain green)

```text
PA-01, PA-02, PA-03, PA-05, PA-06, PA-07, PA-08, EVIDENCE-PA-01
```

```text
test implementation performed = YES
test executed = YES
tests passed = YES (see docs/PHASE_48_WAVE_A_PA04_IMPLEMENTATION_EVIDENCE.md)
```
