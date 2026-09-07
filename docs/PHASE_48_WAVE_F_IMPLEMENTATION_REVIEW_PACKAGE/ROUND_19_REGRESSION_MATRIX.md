# Round 19 Regression Matrix

All Round 13–18 suites preserved. See `ROUND_19_RAW_GATE_OUTPUTS/INDEX.tsv` for exact counts.

| Area | Gate | Expected |
|---|---|---|
| R18 unit | 03_R18_UNIT.txt | 10/10 PASS |
| R18 PG | 04_R18_POSTGRES.txt | 4/4 PASS |
| R17–R13 | 05–14 | PASS |
| R12–R1 | 15–26 | PASS |
| Wave F PG | 27_WAVE_F_POSTGRES.txt | 374+ tests PASS |
| Wave F unit | 28_WAVE_F_UNIT.txt | 88 tests PASS (8 suites) |
| RLS / HTTP | 29–30 | PASS |
| Permission routes / PKG | 31–32 | PASS |
| Migrations | 33–34 | PASS |
| Prior A–E | 35–43 | PASS (E PG 8 suites / 153 tests) |
| API build | 44_API_BUILD.txt | PASS_BASELINE TS6059 only |

Closed areas not reopened: exploreBudget removal, new-create validation parity, Prior E 8/153 pattern.
