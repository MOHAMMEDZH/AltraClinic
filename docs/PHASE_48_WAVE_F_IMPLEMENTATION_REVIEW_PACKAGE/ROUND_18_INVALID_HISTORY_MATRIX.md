# Round 18 Invalid History Matrix

| Case | Fixture | Error | Budget path |
|------|---------|-------|-------------|
| R18-A-U4 | 33.34/3.33 + 33.33/3.33 + 33.33/3.33 | SATURATED_COMMISSION_NOT_EXHAUSTED | No |
| R18-A-U5 counterpart | 3.33+3.33+3.34 → 10.00 | ACCEPT all permutations | No |
| R18-A-U6 | forged comm swap on valid 25-special | NOT_SEQUENTIALLY_REALIZABLE / saturator | No exploreBudget |
| R18-B-T1 PG | planted 9.99/10 + new refund | complete-set reject; 0 new rows/audit | No |
