# Pilot Production Cutover — Kickoff Package (C0)

CTO-authorized **C0 kickoff docs only**. Ops cutover packaging for a real pilot environment.

**This is NOT Phase 52.** Not product features. Not Stripe. Not D5 picker.  
**Cutover has NOT been executed.** Green docs ≠ cutover.

| Field | Value |
|-------|--------|
| **Program** | Pilot Production Cutover (P0) |
| **Canonical base** | `release47-step22-transfer-20260810-0353` @ `64eb2a9` (Phase 51 PR #7 merge) |
| **Branch** | `cursor/pilot-production-cutover-kickoff` |
| **Status** | **C0 kickoff only**; program PA = **PENDING**; C1+ **NOT STARTED** |

| File | Purpose |
|------|---------|
| [01_CURRENT_STATE.md](./01_CURRENT_STATE.md) | Precursors already on lineage |
| [02_CUTOVER_GATE_MAP.md](./02_CUTOVER_GATE_MAP.md) | Step 29 gates → owner → evidence |
| [03_DB_CREDENTIAL_MODEL.md](./03_DB_CREDENTIAL_MODEL.md) | migrate-admin vs runtime-app; NOBYPASSRLS |
| [04_SECRETS_ENV_WIRING.md](./04_SECRETS_ENV_WIRING.md) | K2 / `.env.example` key map (no passwords) |
| [05_SLICE_PLAN.md](./05_SLICE_PLAN.md) | Ordered C0→C5 |
| [06_EXPLICIT_OUT.md](./06_EXPLICIT_OUT.md) | What C0 / this program must not invent |
| [07_ACCEPTANCE_CRITERIA.md](./07_ACCEPTANCE_CRITERIA.md) | Program PA later; C0 = docs only |

**Prefer reuse (do not reinvent):**

- [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md)
- Phase 49 K2 / K3 / K5 / K6
- [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) §§7–14
- Phase 51 L3 go-live checklist (tenant path; ≠ executed cutover)

```text
Phase 51 Production Acceptance = ACCEPTED (merge 64eb2a9; evidence tip 67a6391)
Phase 50 Production Acceptance = ACCEPTED (merge 9a2e89d; evidence tip 2d1f3ec)
Phase 49 Production Acceptance = ACCEPTED (merge 1501190; evidence tip 5bfda08)
Phase 48 Waves A–I = OFFICIALLY CLOSED
Pilot cutover executed = NO
self-granted Pilot Cutover PA = NO
C0 kickoff alone ≠ C1+ authorize
Wave / Phase 49 / 50 / 51 SoR reopen = NOT AUTHORIZED
Phase 52 = NOT AUTHORIZED
D5 picker / Stripe / payment live = NOT IN SCOPE
second test framework / new GH Checks = NOT AUTHORIZED
fake cutover claims = NOT AUTHORIZED
no passwords in git = YES
```
