# ROUND_10_REFUND_CORRECTION_CONCURRENCY_PROOF

## Fresh R10-C stdout (gate run)

### R10-C-T1 refund wins

- `pidA=980524` `pidB=980538`
- `pg_blocking_pids(pidB)=[980524]`
- final net attributed **80.00**
- correction carries refund exactly once after post-lock reread

### R10-C-T2 correction wins

- `pidA=980524` `pidB=980541`
- `pg_blocking_pids(pidB)=[980524]`
- stale-root refund: `Accrual has no remaining commission/attributed revenue to reverse`
- refund on replacement applies once; net **80.00**

### R10-C-T3

- no `40P01` / deadlock
- outcomes recorded in `R10_BLOCKING` buffer → stdout only

Lock order unchanged: identity → ServicePerformance → package → cohort/accrual → post-lock reread → mutate.
