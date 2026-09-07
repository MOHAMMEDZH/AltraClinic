# Round 15 — Requirements Traceability Matrix

| Requirement | Implementation | Tests |
|-------------|----------------|-------|
| R15-A independent min(proposal, remaining) | `computeAuthoritativeRefundReversalAmounts` | R15-A-T1, R15-A-U1 |
| R15-A one-zero REVERSED shape | `assertReversalSignedEconomicShape` + DB CHECK | R15-A-T3, R15-A-U6, R11-A-T3 |
| R15-A stop only when both exhausted | remaining `lte(0) &&` both | R15-A-T1, T4 |
| R15-A complete-set sequential search | `assertRealizableRefundEffectSet` memoized DFS | R15-A-U1–U7, R14 unit |
| R15-A replay/correction/carry/report/package/settlement/concurrency | service paths + tests | R15-A-T2,T5–T12 |
| R15-B selected accrual provenance | trigger `enforce_commission_correction_lineage_provenance` | R15-B-T1–T4, R15-RLS* |
| R15-B tenant parents + createdBy users.tenantId | same trigger | R15-RLS cross-tenant* |
| R15-B ENABLE/FORCE RLS + NOBYPASSRLS | migration + rls-policies.sql | R15-RLS booking_app |
| R15-C zero-history fail-fast | migration DO block | MIG_CLEAN, MIG_UPGRADE, HISTORICAL_NEGATIVE |
| R15-C runtime fail-closed | `correctAndRepost` before lineage insert | R15-C-T5–T8 |
