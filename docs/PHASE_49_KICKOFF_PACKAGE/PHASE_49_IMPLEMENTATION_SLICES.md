# Phase 49 — Implementation Slices (ordered)

**Status:** Planning only. **No product/schema/ops implementation in this package.**  
Implementation requires a **later** CTO authority prompt per slice.

**Recommended first slice after CTO accepts K0:** **K1 — Discovery / inventory only** (no hardening changes).

---

## Dependency overview

```text
K0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs — pending CTO accept]
        │
        ▼
K1 Discovery / inventory ONLY             ← preferred first implementation
        │
        ▼
K2 Secrets / config hygiene
        │
        ▼
K3 Backup / restore posture
        │
        ▼
K4 Observability / alerting readiness
        │
        ▼
K5 Deploy / rollback runbooks
        │
        ▼
K6 Tenant isolation production checks
        │
        ▼
K7 Incident basics + Implementation Review + External PA Precheck
```

Do **not** start K2–K7 in the same unauthorized big-bang. Prefer thin PRs after each CTO slice accept.

---

## Slice K0 — Kickoff package (this folder)

| | |
|--|--|
| **Deliverable** | This folder |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice K1 — Discovery / inventory ONLY — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Inventory existing secrets/config, backup/restore, observability/alerting, deploy/rollback, tenant-isolation gates, and incident-related docs/surfaces @ `9eac595+` — **document gaps only** |
| **Depends on** | K0 accepted; Wave I closed @ `9eac595` |
| **Includes** | Inventory markdown (paths, owners, current status PASS-local/PARTIAL/MISSING); proposed evidence formats; **no** runbook rewrites as “done”; **no** product/SoR changes |
| **Exit of slice** | Authoritative inventory checked in; CTO can authorize K2+ with known gaps |
| **Why first** | Prevents big-bang hardening; proves reuse of Step 28/29 + observability |
| **Risks** | Quietly implementing fixes inside “discovery”; inventing second framework; reopening Wave A–I |

**Proposed K1 scope (for CTO when authorizing implementation):**

1. Secrets/config surface list (env vars, CI secrets usage patterns, log redaction expectations).  
2. Backup/restore current reality (Postgres + related durables) + gap list.  
3. Observability/alerting readiness map to existing Phase 45 / health / CI surfaces.  
4. Deploy/rollback doc inventory (scattered runbooks → gap to SSOT).  
5. Tenant isolation runner inventory (reuse Wave I / RLS / Platform DB).  
6. Incident-related doc inventory.  
7. Do **not** change product SoR; do **not** reopen Phase 48 waves; do **not** claim Phase 49 PA.

---

## Slice K2 — Secrets / config hygiene

| | |
|--|--|
| **Goal** | Close secrets/config gaps from K1 with minimal, fail-closed changes + evidence |
| **Depends on** | K1 |
| **Out** | Phase 50 polish; Wave SoR reopen |

---

## Slice K3 — Backup / restore posture

| | |
|--|--|
| **Goal** | Document posture; define and execute thin restore drill evidence |
| **Depends on** | K1 |
| **Out** | Multi-region DR product; commercial backup SaaS redesign |

---

## Slice K4 — Observability / alerting readiness

| | |
|--|--|
| **Goal** | Readiness evidence on existing observability/health surfaces; alerting criteria without new APM SoR |
| **Depends on** | K1 |
| **Out** | Parallel monitoring product; SIEM replacement |

---

## Slice K5 — Deploy / rollback runbooks

| | |
|--|--|
| **Goal** | SSOT deploy + rollback runbooks aligned to current CI/release |
| **Depends on** | K1 |
| **Out** | New deploy platform rewrite |

---

## Slice K6 — Tenant isolation production checks

| | |
|--|--|
| **Goal** | Package/reuse existing isolation runners as Phase 49 production-check evidence |
| **Depends on** | K1 |
| **Out** | New tenant model / Wave SoR reopen |

---

## Slice K7 — Incident basics + Implementation Review + External PA Precheck

| | |
|--|--|
| **Goal** | Minimal incident playbook; lean review package; **PA = PENDING EXTERNAL** |
| **Depends on** | K1–K6 (as authorized) |
| **Deliverable** | Mirror Wave I review-package style + evidence; **no** self-granted PA |

---

## Explicit non-slices

- Phase 50 UX polish dump  
- Phase 51 commercial launch  
- Wave A–I SoR edits  
- Second test framework  
- Big-bang single PR for K1–K7 without intermediate review  

---

## Risk register (phase-level)

| Risk | Mitigation |
|------|------------|
| Mistaking Wave I / Step 28 greens for Phase 49 exit | CURRENT_STATE_VS_EXIT + hardening deliverables |
| Implementing inside “discovery” | K1 OUT = inventory only |
| Inventing second framework | Reuse Step 28/29 + observability |
| Reopening closed Wave SoRs | CTO + product-failure bar |
| Scope creep into Phase 50/51 | Frozen OUT list |
| Self-granted PA | Acceptance criteria block |
