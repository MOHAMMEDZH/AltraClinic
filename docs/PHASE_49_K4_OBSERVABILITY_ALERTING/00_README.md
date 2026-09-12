# Phase 49 K4 — Observability / Alerting Readiness

| Field | Value |
|-------|--------|
| **Slice** | K4 — Observability / alerting readiness |
| **Status** | Packaging on existing surfaces; **Phase 49 PA = PENDING** |
| **Branch** | `cursor/phase49-production-hardening-kickoff` |
| **Base lineage** | `9eac595` |
| **K3 tip** | `220a931` |
| **K4 tip** | `0dc69be` |
| **Authority** | CTO authorize K4 only; K5–K7 **NOT** started |

## Files

| File | Purpose |
|------|---------|
| [01_SURFACE_MAP.md](./01_SURFACE_MAP.md) | Phase 45 + health/observability routes → Phase 49 readiness |
| [02_ALERTING_CRITERIA.md](./02_ALERTING_CRITERIA.md) | In-repo vs EXTERNAL (paging/on-call) |
| [03_EVIDENCE_RUNBOOK.md](./03_EVIDENCE_RUNBOOK.md) | Named evidence script + Jest pointers |
| [04_EXPLICIT_OUT.md](./04_EXPLICIT_OUT.md) | Non-goals |

## Named evidence command (reuse Jest)

```text
cd apps/api
npm run test:phase49-observability-readiness
```

Wraps existing specs only — **not** forced into Step 28/29 Release 47 onepass.

```text
Phase 49 PA = PENDING
No APM/SIEM/on-call SaaS invented in-repo
K5–K7 = NOT AUTHORIZED
```
