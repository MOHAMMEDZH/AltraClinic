# ROUND_6_CLOSED_AREA_REGRESSION_MATRIX

| Closed area | Round 6 status | Proof |
|-------------|----------------|-------|
| F1 Single Commission SoR / legacy cutover | CLOSED — no regress | Round 1 suite PASS; GoneException paths untouched |
| F2 Invoice/payment earning trigger | CLOSED — no regress | Invoice finalization + PAYMENT_COLLECTED paths still gated; Round 1/4 COLLECTED tests PASS |
| F3 Automatic production billing attribution | CLOSED — no regress | Round 4 F3 production path tests PASS |
| F4 Correction atomicity / correction-vs-refund | CLOSED — no regress | Round 3/4 correction suites PASS; R6 strengthens binding only |
| F4 Basis-aware refund reversal | CLOSED — no regress | Round 4 F4B + R6-PKGCOL-T7 refund after collected PASS |
| F5 Plan timeline / historical / future concurrency | CLOSED — no regress | Round 2/3 F5 tests PASS |
| F6 Tenant / DB / RLS integrity | CLOSED — no regress | Wave F RLS + Round 3 F6A PASS |
| F7 Settlement concurrency | CLOSED — no regress | Round 3 F7 PASS |
| F7 Combined traceability | CLOSED — no regress | Round 4 TRACE PASS |
| R5 Package authoritative basis | CLOSED — no regress | Round 5 PKG1 PASS |
| R5 Package allocation concurrency | CLOSED — no regress | Round 5 PKG2 PASS (T5 fixture aligned to patient provenance) |
| R5 Package RLS | CLOSED — no regress | Round 5 PKG3 PASS |
| R5 TENANT_CUSTOM clinical-service integrity | CLOSED — no regress | Round 5 CSVC PASS |
| R5 Bind endpoint two-way provenance | CLOSED — no regress | Round 5 BIND PASS; shared helper extracted for R6 |

Fixture note: Round 5 PKG2-T5 and Round 2 F4-R2-T8 fixtures updated only to satisfy provenance that Round 6 made fail-closed (patient match; replacement line appointment/clinicalService). Product closed behavior unchanged.
