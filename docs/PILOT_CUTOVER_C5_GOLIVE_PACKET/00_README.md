# Pilot Cutover C5 — Go-live packet

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) — NOT Phase 52 |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **C4 tip** | `5c5698e` |
| **C5 tip** | *(this packaging tip)* |
| **Program PA** | **PENDING EXTERNAL** (CTO decides — not self-granted) |

```text
Product production cutover = NOT CLAIMED
Pilot go-live packet ≠ program PA
C2b Neon PASS · C3 schema restore PARTIAL · C4 dry-run PARTIAL
STOP-the-line items remain (see 03_STOP_THE_LINE.md)
self-granted Pilot Cutover PA = NO
```

| File | Purpose |
|------|---------|
| [01_EVIDENCE_INDEX.md](./01_EVIDENCE_INDEX.md) | C0→C4 tips + uncommitted evidence |
| [02_GATE_SIGN_OFF.md](./02_GATE_SIGN_OFF.md) | Step 29 / L3 gate map |
| [03_STOP_THE_LINE.md](./03_STOP_THE_LINE.md) | Must clear before real tenant pilot |
| [04_KNOWN_LIMITATIONS.md](./04_KNOWN_LIMITATIONS.md) | Carry-forward honesty |
| [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md) | Fake cutover / payment / Phase 52 |
| [06_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md](./06_EXTERNAL_PRODUCTION_ACCEPTANCE_PRECHECK.md) | CTO PA block — **PENDING** |

**Entry:** [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) · Kickoff [`05_SLICE_PLAN.md`](../PILOT_CUTOVER_KICKOFF_PACKAGE/05_SLICE_PLAN.md)
