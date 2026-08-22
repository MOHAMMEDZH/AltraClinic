# Round 16 — Test Results

Fresh run captured under `ROUND_16_RAW_GATE_OUTPUTS/` (see INDEX.tsv). Started ~2026-08-22T00:07:16Z UTC.

## Targeted Round 16

| Gate | Exit | Suites | Tests | Raw |
|---|---|---|---|---|
| R16_UNIT | 0 | 1 | 11 | 01_R16_UNIT.txt |
| R16_POSTGRES | 0 | 1 | 22 | 02_R16_POSTGRES.txt |

### PostgreSQL test IDs (22/22 PASS)
R16-A-T1 … R16-A-T12, R16-B-T1 … R16-B-T10

### Unit test IDs (11/11 PASS)
R16-A-U1 … R16-A-U6, R16-B-U1 … R16-B-U5

## Updated Round 15

| Gate | Exit | Suites | Tests | Raw |
|---|---|---|---|---|
| R15_UNIT | 0 | 1 | 7 | 03_R15_UNIT.txt |
| R15_POSTGRES | 0 | 1 | 20 | 04_R15_POSTGRES.txt |

R15-A-T4 updated: exact 33.34+33.33+33.33 → nets 0.00/0.00; fourth refund rejected.

## Rounds 14→1 (targeted)

All PASS — see INDEX.tsv rows R14_* … R1.

## Complete Wave F

| Gate | Exit | Suites | Tests | Raw |
|---|---|---|---|---|
| WAVE_F_POSTGRES | 0 | 19 | 354 | 20_WAVE_F_POSTGRES.txt |
| WAVE_F_UNIT | 0 | 5 | 45 | 21_WAVE_F_UNIT.txt |
| WAVE_F_RLS | 0 | 1 | 14 | 22_WAVE_F_RLS.txt |
| WAVE_F_HTTP | 0 | 1 | 2 | 23_WAVE_F_HTTP.txt |
| PERM_ROUTES | 0 | — | — | 24_PERM_ROUTES.txt |
| MIG_CLEAN | 0 | — | — | 25_MIG_CLEAN.txt |
| MIG_UPGRADE | 0 | — | — | 26_MIG_UPGRADE.txt |
