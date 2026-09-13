# Pilot Cutover C5 — Go-live packet

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **C4 tip** | `5c5698e` |
| **C5 tip** | `e58995d` |
| **Packaging PA tip** | `b2e1b40` (CTO-granted) |
| **Program status** | Packaging PA **ACCEPTED** @ `b2e1b40`; real tenant pilot **NOT AUTHORIZED** |

```text
Packaging PA = ACCEPTED (CTO @ b2e1b40)
STOP S1–S4 = OPEN (not PASS)
Real tenant / product production cutover = NOT CLAIMED
C2b Neon PASS · C3 schema restore PARTIAL · C4 dry-run PARTIAL
self-granted Pilot Cutover PA = NO
```

| File | Purpose |
|------|---------|
| [01_EVIDENCE_INDEX.md](./01_EVIDENCE_INDEX.md) | C0→C4 tips + uncommitted evidence |
| [02_GATE_SIGN_OFF.md](./02_GATE_SIGN_OFF.md) | Step 29 / L3 gate map |
| [03_STOP_THE_LINE.md](./03_STOP_THE_LINE.md) | Must clear before real tenant pilot |
| [04_KNOWN_LIMITATIONS.md](./04_KNOWN_LIMITATIONS.md) | Carry-forward honesty |
| [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md) | Fake cutover / payment / Phase 52 |
| [06_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md](./06_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md) | Packaging PA **ACCEPTED** @ `b2e1b40`; STOP S1–S4 **OPEN** |

**Entry:** [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) · Kickoff [`05_SLICE_PLAN.md`](../PILOT_CUTOVER_KICKOFF_PACKAGE/05_SLICE_PLAN.md)
