# ROUND_9_RAW_PG_BLOCKING_EVIDENCE

Synthesized from Round 9 concurrency test diagnostics (no credentials / patient data).

## R9-C-T1
- pidA=972161
- pidB=972175
- pg_blocking_pids(pidB)=[972161]
- barrierReached=2026-08-21T10:49:55.303Z
- blockedByA=true
- releaseAt=2026-08-21T10:49:55.364Z
- loserResult=BadRequestException: No open correctable accruals in economic cohort
- finalOpenCount=2
- finalNetAttributed=320.00
- deadlock=false

## R9-C-T2
- pidA=972161
- pidB=972178
- pg_blocking_pids(pidB)=[972161]
- blockedByA=true
- outcome=correction_won_settlement_rejected
- finalOpen=2

## R9-C-T5
- pidA=972161
- pidB=972182
- blockedByA=true
- note=performance-then-package lock order preserved

## R9-E-T2
- assertedBufferLines=26
- containsPidA=true
- containsBlockingPids=true
