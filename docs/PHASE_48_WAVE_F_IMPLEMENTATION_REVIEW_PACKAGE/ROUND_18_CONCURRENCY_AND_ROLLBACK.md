# Round 18 Concurrency and Rollback

- R18-B-T1: invalid historical + new refund — zero new reversal rows, zero new audit entries
- R18-B-T2: valid create + replay idempotent same row id
- R18-B-T3: replay on invalid planted set fail-closed (parity with creation)

Full R17 concurrency matrix unchanged and passing in Wave F PostgreSQL regression.
