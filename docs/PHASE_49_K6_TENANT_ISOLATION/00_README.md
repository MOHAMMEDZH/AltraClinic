# Phase 49 K6 — Tenant Isolation Production-Check Packaging

| Field | Value |
|-------|--------|
| **Slice** | K6 — Thin production-check packaging (reuse only) |
| **Status** | Docs + optional npm wrapper; **Phase 49 PA = PENDING** |
| **Branch** | `cursor/phase49-production-hardening-kickoff` |
| **Base lineage** | `9eac595` |
| **K5 tip** | `8bfa7c6` |
| **K6 tip** | _(set after substantive commit)_ |
| **Authority** | CTO authorize K6 only; K7 **NOT** started |

## Files

| File | Purpose |
|------|---------|
| [01_ISOLATION_CHECKLIST.md](./01_ISOLATION_CHECKLIST.md) | Clinic RLS vs platform admin boundary |
| [02_COMMANDS.md](./02_COMMANDS.md) | Commands at accepting SHA + path-filter force-run |
| [03_EVIDENCE_RUNBOOK.md](./03_EVIDENCE_RUNBOOK.md) | Named wrapper + evidence layout |
| [04_EXPLICIT_OUT.md](./04_EXPLICIT_OUT.md) | Non-goals |

## Named evidence command

```text
cd apps/api
npm run test:phase49-tenant-isolation-check
```

Wraps **existing** `test:platform-db-security` + selected Jest integration patterns only — **not** a new isolation framework; **not** forced as a required GitHub check.

```text
Phase 49 PA = PENDING
Wave A–I SoR reopen = NOT AUTHORIZED
K7 = NOT AUTHORIZED
```
