# Wave F Round 2 Remediation Matrix

| Blocker | Status | Primary change |
|---------|--------|----------------|
| F1 | CLOSED (regression preserved) | GoneException cutover unchanged |
| F2 | CLOSED (regression preserved) | COLLECTED_REVENUE path unchanged |
| F3 | REMEDIATED | Durable `invoice_line_items.servicePerformanceId` FK; removed serviceCode OR encounter heuristic |
| F4 | REMEDIATED | Dual cumulative caps (commission + attributed revenue); concurrent reverse; correction reverse+repost |
| F5 | REMEDIATED | `resolvePlanAt` includes SUPERSEDED historical intervals; post-lock reread; concurrent publish |
| F6 | REMEDIATED | Relation-by-relation QA matrix + INSERT/UPDATE DB proofs |
| F7 | REMEDIATED | Settlement allocation ledger (net settleable); owner report dimensions + attributed revenue |

Migration: `20260820190000_phase48_wave_f_round2_remediation`

Wave F Production Acceptance: **PENDING external review**
