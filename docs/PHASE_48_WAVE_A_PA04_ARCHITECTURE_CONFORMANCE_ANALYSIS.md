# Phase 48 Wave A — PA-04 Architecture Conformance Analysis

| Field | Value |
|-------|--------|
| **Status** | ANALYSIS COMPLETE |
| **Branch** | `cursor/phase48-wave-a-foundation` |
| **Committed HEAD** | `089a3096d0ad8f0183136cd1aa0b4d859dfc7f9b` |
| **Implementation authorization** | NO |
| **Current uncommitted PA-04 code** | PROVISIONAL / NOT ACCEPTED |

## 1. Frozen contract citations (SSOT)

### Target Domain Architecture — PriceVersion

```text
status  # DRAFT | ACTIVE | SUPERSEDED | INACTIVE

Overlap prevention:
no two ACTIVE versions for same (tenant, branch?, service, variant?, unit)
with overlapping effective ranges.
```

Source: `docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` §3.

### Architecture Review — AR-04

```text
Chosen: Append-only PriceVersion under tenant (+ optional branch override);
effectiveFrom/effectiveTo with overlap prevention; deactivate ≠ hard delete.
Historical rule (Freeze matrix): never overwrite published.
```

Sources: `docs/PHASE_48_ARCHITECTURE_REVIEW.md` AR-04;
`docs/PHASE_48_ARCHITECTURE_FREEZE.md` ADR matrix AR-04.

### Explicit non-presence

```text
SCHEDULED does NOT appear in frozen PriceVersion status enum.
```

## 2. Simultaneous requirements under analysis

| ID | Requirement |
|----|-------------|
| R1 | Published commercial PriceVersion fields are immutable / append-only |
| R2 | A current open-ended published price may exist (`effectiveTo = null`) |
| R3 | A tenant may need to define a future price with `effectiveFrom > now` |
| R4 | The current price must remain effective until the future boundary |
| R5 | No two ACTIVE versions for the same commercial identity may have overlapping effective ranges |
| R6 | Future price publication/scheduling must be concurrency-safe |
| R7 | Historical price reconstruction must remain deterministic |
| R8 | Commercial identity = tenantId + branchId/default + clinicalServiceId + pricingUnit + currency + serviceVariantId/default |

Commercial fields treated as published-immutable under R1 (aligned with provisional code + freeze “never overwrite published”):

```text
unitPrice, currency, pricingUnit, taxPercent, effectiveFrom, effectiveTo,
clinicalServiceId, branchId, serviceVariantId, tenantId
```

Lifecycle-only fields (status, publishedAt/By, supersededAt/By, inactivatedAt/By) are not commercial payload.

## 3. Concrete frozen-only transition proof

### Initial state

```text
V1:
  status = ACTIVE
  effectiveFrom = T0
  effectiveTo = null
  commercial key = K
```

### Event at T1

```text
User defines V2 for same commercial key K
  effectiveFrom = T2
  where T2 > T1 > T0
```

### Exhaustive frozen-status transitions (DRAFT | ACTIVE | SUPERSEDED | INACTIVE only)

#### Transition F1 — Mutate V1.effectiveTo = T2, publish V2 as ACTIVE

```text
V1.effectiveTo := T2   # MUTATION of published commercial field
V2.status = ACTIVE
```

| Req | Result |
|----|--------|
| R1 | **FAIL** — published `effectiveTo` overwritten |
| R2–R5 | Can pass after mutation |
| Verdict | **FORBIDDEN under frozen append-only** |

#### Transition F2 — Publish V2 as ACTIVE now; leave V1 ACTIVE open-ended

```text
V1 ACTIVE [T0, ∞)
V2 ACTIVE [T2, ∞)
```

| Req | Result |
|----|--------|
| R1 | PASS (if no field rewrite) |
| R4 | Ambiguous — both ACTIVE; “current until T2” is not persisted |
| R5 | **FAIL** — ranges overlap on [T2, ∞) |
| Verdict | **FORBIDDEN** (even if lookup uses “latest effectiveFrom”) |

Frozen overlap is a **persisted ACTIVE range** invariant, not a lookup heuristic.

#### Transition F3 — Publish V2 as ACTIVE now; SUPERSEDE V1 immediately (lifecycle-only)

```text
V1 → SUPERSEDED at T1
V2 → ACTIVE from T2 (or immediately)
```

| Req | Result |
|----|--------|
| R1 | PASS if commercial columns untouched |
| R4 | **FAIL** — current price ceases to be ACTIVE before T2 (early gap / early removal) |
| R5 | Can pass |
| Verdict | **FORBIDDEN** for future-dated commercial continuity |

#### Transition F4 — Keep V2 as DRAFT until T2; at T2 SUPERSEDE V1 + DRAFT→ACTIVE

```text
Until T2: V2 remains DRAFT (mutable, not published)
At T2 (job/operator): lock(K); V1→SUPERSEDED; V2→ACTIVE
```

| Req | Result |
|----|--------|
| R1 | PASS for published rows (V1 commercial fields untouched) |
| R2 | PASS |
| R3 | **WEAK / FAIL commercially** — future price is not a published immutable commercial fact; it remains editable DRAFT |
| R4 | PASS if activation is timely |
| R5 | PASS at activation if lock + re-check |
| R6 | PASS only if activation uses commercial-key lock |
| R7 | PASS only if historical rule defined for SUPERSEDED open-ended rows |
| Verdict | **Does not satisfy published future-effective pricing** as a first-class commercial capability |

Frozen AR-04 centers on **published** append-only versions. Leaving the future price as DRAFT avoids enum expansion but fails the business/frozen intent of effective-dated **published** pricing that auditors and operators can rely on before the boundary.

#### Transition F5 — Publish V2 as INACTIVE or SUPERSEDED “holding” state until T2

```text
Misuse of INACTIVE/SUPERSEDED as a scheduling queue
```

| Req | Result |
|----|--------|
| Semantics | **Corrupt** — SUPERSEDED/INACTIVE already mean end-of-life / withdrawn |
| Verdict | **Not a valid frozen interpretation** |

#### Transition F6 — Weaken R5 (“multiple ACTIVE OK; latest wins”)

| Req | Result |
|----|--------|
| R5 | **FAIL by definition** |
| Verdict | **Forbidden without Freeze Amendment that weakens overlap** |

### Proof conclusion

```text
Can R1–R8 all be satisfied using ONLY frozen statuses
DRAFT | ACTIVE | SUPERSEDED | INACTIVE
without:
  - mutating a previously published effectiveTo,
  - introducing another first-class lifecycle state,
  - adding another immutable scheduling/effective-range construct,
  - or weakening the frozen overlap invariant?

= NO

ARCHITECTURE CHANGE REQUIRED = YES
```

The contradiction is structural:

```text
open-ended ACTIVE (R2)
+ published future successor (R3)
+ no early gap (R4)
+ no ACTIVE overlap (R5)
+ no published commercial rewrite (R1)
```

cannot coexist inside the four-status model without one of the forbidden escapes.

## 4. Classification of current uncommitted SCHEDULED implementation

Inspected (left untouched by this task):

```text
apps/api/prisma/schema.prisma  (ClinicalPriceVersionStatus includes SCHEDULED)
apps/api/prisma/migrations/20260814150000_phase48_wave_a_price_scheduled_status/migration.sql
apps/api/src/modules/clinical-catalog/application/clinical-price-version.service.ts
apps/api/src/modules/clinical-catalog/application/dto/clinical-catalog.dto.ts
tests: clinical-price.unit.spec.ts, clinical-price.concurrency.postgres.integration.spec.ts
```

### Behavior summary

| Aspect | Current provisional behavior |
|--------|------------------------------|
| Status enum | Adds `SCHEDULED` |
| Migration | `ALTER TYPE ... ADD VALUE 'SCHEDULED'` |
| Publish future | DRAFT → SCHEDULED; prior ACTIVE untouched |
| Publish now | DRAFT → ACTIVE; overlapping prior ACTIVE → SUPERSEDED (lifecycle only) |
| Lookup | `status IN (ACTIVE, SCHEDULED)` + window + `orderBy effectiveFrom desc take 1` |
| Schedule chain | Multiple SCHEDULED allowed if distinct `effectiveFrom` |
| Activation | **No** runtime `SCHEDULED → ACTIVE` at boundary |
| Historical | Relies on lookup including SCHEDULED once `effectiveFrom <= at`; SUPERSEDED excluded |
| Concurrency | `pg_advisory_xact_lock(hashtext(commercialKey))` on publish |
| Overlap | Enforced for ACTIVE ranges; SCHEDULED excluded from ACTIVE overlap count |

### Explicit answers

```text
Does SCHEDULED exist in the accepted frozen architecture? NO

Is adding SCHEDULED only an implementation detail,
or does it change the PriceVersion lifecycle contract?
→ It changes the lifecycle contract.
  Frozen status set is closed: DRAFT|ACTIVE|SUPERSEDED|INACTIVE.
  SCHEDULED introduces a new commercially published, non-ACTIVE state
  and changes effective lookup to include non-ACTIVE rows.

Is there an explicit runtime transition SCHEDULED → ACTIVE at effectiveFrom? NO

Can a SCHEDULED version remain SCHEDULED after becoming
the commercially effective price? YES (current code)

Can multiple future SCHEDULED rows have open-ended
effective ranges that logically overlap? YES

Does lookup resolve this by latest effectiveFrom? YES
```

### Architecture semantic change

```text
architecture semantic changes = NOT 0
current implementation acceptance status = PROVISIONAL / NOT ACCEPTED
```

Known defects vs production-grade schedule semantics (even if tests are green):

1. Effective commerciality is decoupled from ACTIVE status (SCHEDULED can be “the price”).
2. No mandatory activation transition → ACTIVE ceases to mean “currently commercially effective”.
3. Open-ended SCHEDULED chains rely on latest-`effectiveFrom` arbitration among non-ACTIVE published rows.
4. Prior ACTIVE remains open-ended while a later SCHEDULED is also open-ended → calendar ranges coexist; only the ACTIVE-count trick satisfies a narrow reading of R5.
5. Prior evidence claiming “architecture semantic changes = 0 / no Freeze Amendment” is **incorrect under Freeze SSOT**.

## 5. AR-05 boundary (unchanged, must stay separated)

```text
AppointmentServiceSnapshotRevision preserves booked commercial history.
Invoices do not reconstruct past appointment prices from live PriceVersion.
```

PriceVersion historical lookup (admin/audit/effective-at-T) is **not** appointment invoice reconstruction.

## 6. Decision gate for Wave A Production Acceptance

```text
PA-04 Freeze Amendment = ACCEPTED AND FROZEN (external)
PA-04 implementation = AUTHORIZED NEXT
PA-04 implementation performed = NO
PA-04 Production Acceptance = still OPEN (blocked until implementation + T1–T44 + evidence)
Self-amendment of freeze = FORBIDDEN (new ACR required for semantic change)
Provisional SCHEDULED code = must be realigned to accepted amendment in next implementation task
```

## 7. Addendum — external conditions package (docs-only)

External review approved Option B; conditions closed and amendment **accepted**:

```text
docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md
```

```text
CONDITION-01 Due-activation correctness guarantee = CLOSED
CONDITION-02 One authoritative commercial time boundary = CLOSED
CONDITION-03 Canceled-never-effective excluded from effective history = CLOSED
CONDITION-04 Multi-due catch-up deterministic/atomic = CLOSED
FA-01 ACTIVE cardinality semantics = CLOSED
FA-02 ACTIVE→INACTIVE historical end = CLOSED
FA-03 explicit effectiveTo / expired schedule semantics = CLOSED
FC-01 terminal lifecycle semantics = CLOSED
FC-02 insertion-order-independent interval validation = CLOSED
Option B architecture ambiguity count = 0
```

This conformance analysis remains the historical proof that frozen-only four statuses
could not satisfy R1–R8 without amendment. Implementation is now **authorized next**
under the accepted SSOT; this document itself does not implement PA-04.
