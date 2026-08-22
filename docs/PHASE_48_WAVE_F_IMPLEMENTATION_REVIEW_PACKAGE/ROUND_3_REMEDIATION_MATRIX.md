# Wave F Round 3 Remediation Matrix

| Blocker | Status | Primary change |
|---------|--------|----------------|
| F1 | CLOSED (regression preserved) | GoneException cutover unchanged |
| F2 | CLOSED (regression preserved) | COLLECTED_REVENUE path unchanged |
| R3-F3A | REMEDIATED | Production Invoice.create + PrismaInvoiceRepository persists servicePerformanceId; appointment invoice resolves SP; bind endpoint for later binding; immutability trigger |
| R3-F4A | REMEDIATED | correctAndRepost single outer transaction; tx-aware reverse/post |
| R3-F5A | REMEDIATED | Future publish closes prior ACTIVE into non-overlapping SUPERSEDED interval; same/overlap fail-closed |
| R3-F6A | REMEDIATED | 13 INSERT + 13 UPDATE named DB proofs |
| R3-F6B | REMEDIATED | settlement_allocations RLS lifecycle + NOBYPASSRLS |
| R3-F7A | REMEDIATED | Concurrent settlement PostgreSQL races |
| R3-F7B | REMEDIATED | Owner report drilldown: SP/snapshot/invoice/inventory/reversal/settlement |
| HYGIENE | REMEDIATED | git diff --check clean |

Migration: `20260820200000_phase48_wave_f_round3_remediation`

Wave F Production Acceptance: **PENDING external review**
