# ROUND 13 — Concurrency and Lock Evidence

## Lock order (R13-A)

1. ServicePerformance / cross-basis scope
2. Package allocation (when present)
3. Invoice lines for performance + replacement (`ORDER BY id FOR UPDATE`)
4. Cohort accrual roots (`ORDER BY id FOR UPDATE`)

## R13-A-T7

Two independent Prisma clients; winner holds interactive transaction; loser blocks (`pg_blocking_pids`); after release loser rejects with stale ACTIVE binding message; exactly one ACTIVE line and one correction-repost successor.

See `ROUND_13_RAW_GATE_OUTPUTS/01_R13pg.txt` for `R13_DIAG` JSON including `pg_blocking_pids`.
