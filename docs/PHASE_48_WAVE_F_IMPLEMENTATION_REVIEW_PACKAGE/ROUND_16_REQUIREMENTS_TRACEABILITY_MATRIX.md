# Round 16 — Requirements Traceability Matrix

| ID | Requirement | Implementation | Test(s) | Gate |
|---|---|---|---|---|
| R16-A-1 | Derive refund from InvoiceRefund; never caller proportion | `computeAuthoritativeRefundReversalAmounts` | R16-A-T1..T12 | R16_POSTGRES |
| R16-A-2 | Authoritative denominator (invoice total / collected) | same + complete-set denom | R16-A-T7/T8 | R16_POSTGRES |
| R16-A-3 | Distinct refund IDs once in cumulative basis | priorRefundIds Set | R16-A-T3 | R16_POSTGRES |
| R16-A-4 | Saturation consumes all remaining dims | `basisAfter >= denom` branch | R16-A-T1/T2 | R16_POSTGRES + R16_UNIT |
| R16-A-5 | Residual within remaining capacity | applyAuthoritativeRefundEffect | R16-A-U2, R16-A-T2 | R16_UNIT/PG |
| R16-A-6 | Below denom: proportional + caps | else branch | R16-A-U3, R16-A-T5 | R16_UNIT/PG |
| R16-A-7 | One-zero tails preserved | R15 path retained | R16-A-T5 | R16_POSTGRES |
| R16-A-8 | Exhausted → fail closed; replay idempotent | BadRequest + acceptExisting | R16-A-T3/T4 | R16_POSTGRES |
| R16-A-9 | Canonical identity / idempotencyKey | unchanged | R16-A-T3/T10 | R16_POSTGRES |
| R16-A-10 | Correction/carry preserves effects | correctAndRepost | R16-A-T9 | R16_POSTGRES |
| R16-A-11 | No UUID economic authority | exacts+specials DP | R16-A-U4, R16-B-U4 | R16_UNIT |
| R16-A-12 | Lock order unchanged | no lock changes | R16-A-T10 | R16_POSTGRES |
| R16-B-1 | Remove max-12 | refund-complete-set.ts | R16-B-T1/T2 | R16_POSTGRES |
| R16-B-2 | No replacement fixed cap | no SET_TOO_LARGE | R16-B-U1..U5 | R16_UNIT |
| R16-B-3 | Scalable Decimal validator | exacts + bitmask specials | R16-B-U3 (50) | R16_UNIT |
| R16-B-4 | Create/replay/correct compatible | assert on acceptExisting | R16-B-T2/T3 | R16_POSTGRES |
| R15-A-T4 | Superseded: exact 100% → 0/0 | updated expectation | R15-A-T4 | R15_POSTGRES |
