# Round 14 Concurrency Proof

## R14-C-T1 (mandatory)

Two independent Prisma clients:

1. Winner holds correction transaction open after success (SP lock retained).
2. Loser starts different `correctionEventId` / replacement.
3. Test polls `pg_blocking_pids(loserPid)` until winner PID observed.
4. Asserts:
   - `expect(blocked).toBe(true)`
   - `expect(blockers).toContain(pidA)`
   - `expect(bOutcome).toBe('err')`
   - loser message matches stale/ACTIVE/SUPERSEDED/successor guard
   - exactly one ACTIVE invoice line
   - exactly one correction-repost successor
   - net attributed 160.00 / commission 16.00
   - lineage only for winner event
5. Raw `R14_DIAG` JSON includes pids and blockers.

R13-A-T7 strengthened with the same mandatory asserts (not log-only).
