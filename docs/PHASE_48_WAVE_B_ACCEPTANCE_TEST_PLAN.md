# Phase 48 Wave B — Acceptance Test Plan

```text
Wave B executable packs = REQUIRED
test framework = Jest + PostgreSQL integration harness (reuse Wave A patterns)
production DB = FORBIDDEN
```

## Pricing / Snapshot Pack (B-SNAP-01..20)

| Id | Expectation | Spec coverage |
|----|-------------|---------------|
| B-SNAP-01 | booking creates revision 1 atomically | `wave-b-snapshot` |
| B-SNAP-02 | revision 1 copies exact price identity/value | covered (unitPrice/tax; priceVersionId nullable in fixture) |
| B-SNAP-03 | branch override price snapshotted | PASS — executable B-SNAP-03 captures branch override commercial fields on revision 1 |
| B-SNAP-04 | pre-CONFIRMED commercial change → revision 2 | covered |
| B-SNAP-05 | revision 1 unchanged | covered |
| B-SNAP-06 | in-place commercial mutation rejected | covered — API + DB BEFORE UPDATE/DELETE trigger |
| B-SNAP-07 | CONFIRMED blocks ordinary commercial edits | covered — generic update redirects to correction endpoint |
| B-SNAP-08 | time-only reschedule after CONFIRMED does not reprice | covered |
| B-SNAP-09 | time-only reschedule does not create revision | covered |
| B-SNAP-10 | future PriceVersion activation does not alter snapshot | PASS — executable B-SNAP-10 asserts existing snapshot unitPrice unchanged |
| B-SNAP-11 | invoice flag ON uses effective snapshot | WB07-BILL-01 + invoice handler |
| B-SNAP-12 | invoice does not query live PriceVersion | handler uses snapshot only when present/flag ON |
| B-SNAP-13 | canonical appointment missing snapshot fails closed when flag ON | handler fail-closed |
| B-SNAP-14 | legitimate zero requires commercialReason | covered |
| B-SNAP-15 | accidental zero fallback forbidden | covered (zero + reason) |
| B-SNAP-16 | post-CONFIRMED correction appends revision | covered |
| B-SNAP-17 | legacy mapped synthetic snapshot | covered |
| B-SNAP-18 | legacy unmapped clinicalServiceId=null readable | covered |
| B-SNAP-19 | ambiguous legacy not silently mapped | backfill script refuses guess |
| B-SNAP-20 | cross-tenant snapshot access denied | covered |

## Scheduling Concurrency Pack (B-CON-01..20)

Real PostgreSQL advisory locks. Implemented in `wave-b-concurrency.postgres.integration.spec.ts`.
B-CON-17 = DB-backed portal idempotency ledger concurrent same key.
B-CON-20 / WB03-ROLLBACK-01 = force failure after appointment create before snapshot → both counts unchanged.

## Provider Eligibility Pack (B-ELIG-01..18)

`wave-b-eligibility.unit.spec.ts` — flags unit + PG cases for fail-closed, tenant/branch scope, inactive/future/expired, filter, readiness, activate.
WB02-READY-01 = authoritative activation population (enabled configs × provider roles); subset lists rejected on activate.

## Resource Requirement Pack (B-RES-01..08)

`wave-b-resources.unit.spec.ts` — B-RES-01..08 covered.
WB04-RES-01..04 = `AppointmentResourceAllocation` persistence + overlap via allocation join (`wave-b-pa-blockers`).

## Migration Pack (B-MIG-01..10)

`wave-b-migration.postgres.integration.spec.ts` + clean/upgrade scripts. B-MIG-01..10 include real row preservation for serviceType/deletedAt + backfill mapped/unmapped/ambiguous/idempotent.
PA migration `20260815120000_phase48_wave_b_pa_blockers` adds trigger, allocations, portal ledger, RLS (provider ownership in service layer).

## PA Blockers Pack (WB01–WB07)

`wave-b-pa-blockers.postgres.integration.spec.ts` + `update-appointment.handler.spec.ts` + strengthened B-SNAP/B-CON/B-MIG.
Permission routes: `validate-phase48-wave-b-permission-routes.mjs` (8 booking-integrity ops × 3 matrices).

## Final narrow closure pack (WB-PA-02 / WB-PA-07)

`wave-b-final-2blocker-closure.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB02-SERIES-DISCOVERY-01 | unrelated future density cannot hide later series peers |
| WB02-SERIES-DISCOVERY-02 | peers spanning multiple pages all discovered (no silent truncation) |
| WB02-SERIES-LOCKORDER-01 | multi-provider/resource keys globally sorted; single acquisition pass |
| WB02-SERIES-LOCKORDER-02 | competing reversed compositions — no deadlock; no partial commit |
| WB02-SERIES-LOCKORDER-03 | **shared** P1+P2+R1 advisory keys in reversed composition — real contention; no deadlock |
| WB02-SERIES-RETRY-TX-01 | provider identity change → abort tx; NEW tx rebuilds global keys once |
| WB02-SERIES-RETRY-TX-02 | allocation change → abort tx; NEW tx rebuilds resource keys |
| WB02-SERIES-RETRY-TX-03 | identity changes every attempt → fail closed; zero peer updates |
| WB02-SERIES-REREAD-01 | concurrent provider change seen on post-lock fresh reread |
| WB02-SERIES-REREAD-02 | concurrent allocation change — stale pre-lock alloc unused |
| WB02-SERIES-REREAD-03 | concurrent cancel/status — fresh status respected; no stale write |
| WB02-SERIES-ROWLOCK-01 | concurrent provider A→B blocks on row lock / retries; no stale A-validate→B-final |
| WB02-SERIES-ROWLOCK-02 | concurrent resource mutation cannot stale-commit under FOR UPDATE |
| WB02-SERIES-ROWLOCK-03 | overlapping advisory keys + row locks; no deadlock; no partial commit |
| WB02-SERIES-ROWLOCK-04 | cancel after discovery → fresh FOR UPDATE reread fails closed |
| WB07-BACKFILL-BOUNDARY-01 | LEGACY missing snapshot → LEGACY_BACKFILL_ELIGIBLE → synthetic created |
| WB07-BACKFILL-BOUNDARY-02 | CANONICAL_REQUIRED missing snapshot → CANONICAL_INTEGRITY_FAILURE; no synthetic |
| WB07-BACKFILL-BOUNDARY-03 | mixed dataset — only legacy processed |
| WB07-BACKFILL-BOUNDARY-04 | rerun after legacy completion — remaining 0; no duplicates |
| WB07-BACKFILL-BOUNDARY-05 | classification deterministic across reruns (by snapshotWriteMode) |
| WB07-CUTOVER-REAL-01 | cutover from DB execution CURRENT_TIMESTAMP; not migration-filename pseudo |
| WB07-CUTOVER-REAL-02 | corrected marker stable across redeploy simulation |
| WB07-CUTOVER-REAL-03 | LEGACY provenance eligible even when createdAt is after marker |
| WB07-CUTOVER-REAL-04 | CANONICAL_REQUIRED integrity failure even when createdAt is before marker |
| WB07-CUTOVER-REAL-05 | mixed LEGACY/CANONICAL_REQUIRED → only legacy processed; fail if canonical remains |
| WB07-PROVENANCE-01 | historical rows → snapshotWriteMode=LEGACY |
| WB07-PROVENANCE-02 | flag OFF booking → LEGACY + LEGACY_BACKFILL_ELIGIBLE |
| WB07-PROVENANCE-03 | flag ON → CANONICAL_REQUIRED + revision 1 atomic |
| WB07-PROVENANCE-04 | revision-1 fault → appointment rolls back; no orphan CANONICAL_REQUIRED |
| WB07-PROVENANCE-05 | corrupted CANONICAL_REQUIRED → hard integrity failure |
| WB07-PROVENANCE-06 | OFF→ON→OFF→ON preserves per-appointment provenance |
| WB07-PROVENANCE-07 | mixed dataset classification + hard-fail on corrupted canonical |
| WB07-COUNT-SCALE-01 | bounded batch final counts; exact totals |
| WB07-COUNT-SCALE-02 | reduced-batch >50k-equivalent exhaustion; deterministic rerun |

## Queue / Beauty integrity pack

`wave-b-queue-beauty-integrity.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB01-QUEUE-COMMERCIAL-LOCK-01..03 | CHECKED_IN commercialLockedAt; survives CANCELLED; blocks ordinary reprice |
| WB06-QUEUE-ACTOR-01..03 | snapshot/audit actor = authenticated actor; missing actor fail closed |
| WB07-QUEUE-ELIG-01..03 | eligibility ON deny/allow |
| WB07-QUEUE-RESOURCE-01..04 | requirements + allocations + concurrent exclusive resource |
| WB02-QUEUE-ASSIGNROOM-01..05 | assignRoom concurrency / branch / clear / multi-alloc / fresh |
| WB02-BEAUTY-SYNC-01..04 | Beauty reschedule concurrency / eligibility / fresh / CANONICAL serviceType |

## Queue lifecycle / Beauty create / eligibility independence pack

`wave-b-lifecycle-beauty-elig.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB01-QUEUE-LIFECYCLE-LOCK-01..03 | check-in/serving stamp commercialLockedAt; existing lock preserved on COMPLETED |
| WB06-QUEUE-LIFECYCLE-ACTOR-01..03 | check-in/status actor provenance; missing actor fail closed |
| WB02-BEAUTY-CREATE-CONCURRENCY-01..04 | LEGACY Beauty create under advisory locks; shared namespace with normal create |
| WB07-QUEUE-ELIG-FLAG-INDEPENDENCE-01..03 | eligibility independent of canonical-write for Queue |
| WB07-BEAUTY-ELIG-FLAG-INDEPENDENCE-01..04 | eligibility independent of canonical-write for Beauty |

## Lifecycle row-lock / Queue event TX / Beauty tenant+resource pack

`wave-b-lifecycle-audit-tenant-resource.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB01-LIFECYCLE-ROWLOCK-01..03 | FOR UPDATE serialization; lock stamped once; T1 preserved |
| WB01-QUEUE-APPLIED-FALSE-01..02 | applied=false rolls back ticket/event; missing appointment fail closed |
| WB06-QUEUE-EVENT-TX-01..04 | QueueTicketEvent same tx; failure rolls back; actor = U1 |
| WB05-BEAUTY-PROVIDER-TENANT-01..02 | foreign/unknown provider deny independent of eligibility |
| WB05-BEAUTY-SERVICE-TENANT-01..03 | TENANT_CUSTOM ownership + GLOBAL accessibility independent of eligibility |
| WB07-BEAUTY-RESOURCE-01..05 | requirements, allocations, foreign deny, exclusive concurrency, empty OK |

## AssignQueueRoom QueueTicketEvent TX / actor pack

`wave-b-assignroom-event-tx.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB06-ASSIGNROOM-EVENT-TX-01 | allocation+ticket+audit+event commit together |
| WB06-ASSIGNROOM-EVENT-TX-02 | forced event failure rolls entire assignment back |
| WB06-ASSIGNROOM-ACTOR-01..02 | event/audit actor = authenticated U1; no provider substitution |
| WB06-ASSIGNROOM-ACTOR-03 | missing actor fail closed |

## Final residual narrow pack (BulkReschedule / Update fresh / queue / beauty / immutability)

`wave-b-final-narrow-residual.postgres.integration.spec.ts`:

| Id | Expectation |
|----|-------------|
| WB02-BULK-ROWLOCK-01 | BulkReschedule cannot stale-validate provider A then finish with B |
| WB02-BULK-ROWLOCK-02 | multi-appointment bulk all-or-nothing under concurrent mutation |
| WB02-UPDATE-FRESH-01 | provider-only update preserves post-lock T2 (does not restore stale T1) |
| WB02-UPDATE-FRESH-02 | unspecified status/resources from post-lock fresh row |
| WB02-UPDATE-FRESH-03 | final lock-set mismatch → abort; NEW tx retry; no second lock pass in same tx |
| WB07-QUEUE-CANONICAL-01 | walk-in flag ON + clinicalServiceId → CANONICAL_REQUIRED + rev1 |
| WB07-QUEUE-CANONICAL-02 | walk-in flag ON without clinicalServiceId → fail closed; no LEGACY row |
| WB07-QUEUE-LEGACY-01 | walk-in flag OFF → LEGACY |
| WB07-BEAUTY-CANONICAL-01 | beauty sync flag ON → fail closed; no silent LEGACY |
| WB07-BEAUTY-LEGACY-01 | beauty sync flag OFF → LEGACY |
| WB07-PROVENANCE-IMMUTABLE-01 | LEGACY → CANONICAL_REQUIRED rejected at DB |
| WB07-PROVENANCE-IMMUTABLE-02 | CANONICAL_REQUIRED → LEGACY rejected at DB |
| WB07-PROVENANCE-IMMUTABLE-03 | same-value provenance update with other fields succeeds |
| WB07-CREATE-PATH-MATRIX-01 | production create paths cannot silent-LEGACY while canonical ON |

## Governance

```text
test implementation performed = YES
test execution evidence = YES — see PHASE_48_WAVE_B_IMPLEMENTATION_EVIDENCE.md
Wave B Production Acceptance = PENDING EXTERNAL REVIEW
Wave C = NOT AUTHORIZED
```
