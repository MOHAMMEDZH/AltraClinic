# ROUND 11 — Requirement / Test Matrix

| ID | Requirement | Production invariant | Test ID | Result |
|----|-------------|----------------------|---------|--------|
| R11-A1 | Row shape + sign | status=REVERSED; attributedRevenueAmount & commissionAmount strictly negative and non-zero | R11-A-T3, R11-A-T4 | PASS |
| R11-A2 | Full provenance parity | Exact match of root lineage fields before idempotent return | R11-A-T5 | PASS |
| R11-A3 | Authoritative economics | Shared `computeAuthoritativeRefundReversalAmounts`; exclude self when validating; exact decimal equality | R11-A-T1, R11-A-T2, R11-A-T6, R11-A-T8 | PASS |
| R11-A4 | Carry / legacy lineage | Canonical `rev:{root}:{refund}`; legacy `rev_corr_refund:{root}:{refund}:{event}` only after full validation | R11-A-T7, R11-A-T9 | PASS |
| R11-A5 | Unique-conflict txn safety | Savepoint around insert; recover only refund-semantic P2002; re-validate fully | R11-A-T10, R11-A-T11, R11-A-T12 | PASS |
| R11-B | Exhaustive rollback | Durable audit write then throw on `refund_carried`; before/after snapshot equality | R11-B-T1, R11-B-T2 | PASS |
| R11-C | Evidence metadata | No invalid self-hash; file count = recounted regular files | R11-C-T1, R11-C-T2 | PASS |

Inherited closed: F1–F7, Round 5–10 (not reopened).
