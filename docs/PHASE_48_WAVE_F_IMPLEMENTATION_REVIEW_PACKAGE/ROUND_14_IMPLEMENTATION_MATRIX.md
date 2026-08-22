# Round 14 Implementation Matrix

| ID | Defect | Production change | Tests | Status |
|----|--------|-------------------|-------|--------|
| R14-A | Unsaturated complete-set rejected valid one-dimension residual from `roundMoney` | `refund-complete-set.ts` residual = min(proposal, remaining) per dimension; at most one residual; must exhaust ≥1 dimension; all-full may leave one/both dims with remainder | R14-A-U1…U8, R14-A-PG1 | CLOSED |
| R14-B | Same-event replay required correction-reverse of selected rem=0 root | Durable `commission_correction_lineages` + lineage-first replay; rem=0 selected root no longer inferred from reverse rows | R14-B-T1…T8 | CLOSED |
| R14-C | R13-A-T7 logged blocker without mandatory asserts | R14-C-T1 + strengthened R13-A-T7: `blocked`, `pg_blocking_pids`, loser err, exactly-one ACTIVE/repost | R14-C-T1, R13-A-T7 | CLOSED |

Closed areas F1–F7 / Rounds 1–13 preserved. Status: READY FOR EXTERNAL REVIEW only.
