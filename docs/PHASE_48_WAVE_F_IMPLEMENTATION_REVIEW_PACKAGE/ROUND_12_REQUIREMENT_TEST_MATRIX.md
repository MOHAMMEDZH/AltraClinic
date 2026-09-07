# ROUND 12 — Requirement / Test Matrix

| ID | Requirement | Production | Tests | Result |
|----|-------------|------------|-------|--------|
| R12-A | Order-independent capped multi-refund carry | `carryForwardPriorRefundReversals` complete-set projection; rem=0 correctable when refund history exists | R12-A-T1…T10 | PASS |
| R12-B | P2002 recovery only around `commissionAccrual.create` | insert try/catch; audit outside; empty target not recoverable | R12-B-T1…T8 | PASS |
| R12-C | Collection metadata count agreement | docs + R12-C-T1 (378 rows + 06 + 18 = 380 files) | R12-C-T1 | PASS |

Inherited closed: F1–F7, Rounds 5–11.
