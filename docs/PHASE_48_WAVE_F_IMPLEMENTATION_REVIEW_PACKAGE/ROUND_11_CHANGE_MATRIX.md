# ROUND 11 — Change Matrix

| Area | Before (Round 10) | After (Round 11) | Files |
|------|-------------------|------------------|-------|
| Existing refund accept | `assertCompatibleRootRefundReversal` optional amounts; no status/sign; no full lineage; return before refund load | `acceptExistingRootRefundReversal` requires REVERSED, negative non-zero amounts, full root provenance, permitted idempotency key, and exact authoritative economics (self excluded from caps) | `commission-accrual.service.ts` |
| Shared calculator | Inline proportion math only on create path | `computeAuthoritativeRefundReversalAmounts` shared by create + validation | same |
| Unique conflict | Any P2002 + partial assert | `isRecoverableCommissionRefundUniqueConflict` + full accept; carry create wrapped in `withSavepoint` | same |
| Legacy carry keys | Semantic lookup only (REVERSED filter) | Permitted `rev_corr_refund:{root}:{refund}:{uuid}` after full validation; unknown keys fail closed | same |
| Rollback proof | In-memory auditCalls only | R11-B writes durable `auditEntry` in-txn then throws; snapshot equality | `wave-f-round11.postgres.integration.spec.ts` |
| Migration | Round 10 unique index | No Round 11 migration (index preserved; lineage proven via existing columns) | n/a |

No production test hooks reintroduced.
