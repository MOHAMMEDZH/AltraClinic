# ROUND_7_REAL_PRODUCTION_PATH_MATRIX

| Path | Flow | Result |
|------|------|--------|
| A | Package alloc → pay 800/5000 → COLLECTED attributed 160 | PASS |
| B | Shared FOR UPDATE race invoice vs collected | PASS |
| C | Pin mismatch reject; correction reuse allocation | PASS |
| D | COLLECTED correctAndRepost same-invoice proportional | PASS |

Services: `CommissionAccrualService`, `CommissionPackageAllocationService` — real Prisma PostgreSQL, no mocked SoR.
