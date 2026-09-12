# K1 — Incident Basics Inventory

**Lineage:** `9eac595+` · **Owner:** Platform Security on-call → Eng lead → Release Manager  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Security runbooks (primary) | `docs/SECURITY_RUNBOOKS.md` — credential leak, session compromise, cross-tenant, entitlement/cache, audit failure, notifications, deps, rate-limit, plan mutation, release-blocking, CSP | **PASS-local** |
| Step 29 escalation / on-call | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §8.3 | **PASS-local** |
| Audit Center docs | `docs/AUDIT_CENTER.md` | **PARTIAL** (audit SoR; not full incident playbook) |
| Events / observability investigation aids | `docs/EVENTS.md`, observability architecture correlation | **PARTIAL** |
| SECURITY.md monitoring note | `docs/SECURITY.md` (mentions pairing monitoring with IR playbooks) | **PARTIAL** |
| Dedicated `INCIDENT_*.md` / SEV matrix SSOT | No dedicated Phase 49 incident basics file | **MISSING** as Phase 49 package (content largely in SECURITY_RUNBOOKS) |
| External paging / ticket system wiring | Deployment-owned (Step 29) | **MISSING** in-repo (expected) |

---

## What already covers “basics”

`SECURITY_RUNBOOKS.md` already provides detection → containment → evidence → rollback → ownership for major classes. Phase 49 should **package/thin-wrap**, not rewrite product security.

---

## Gaps (for K7)

1. No single **Phase 49 Incident Basics** one-pager (SEV definitions, first 15 minutes, comms, when to call Release Manager) linked from hardening review package.
2. On-call tooling (PagerDuty/etc.) external — document interface only.
3. Avoid duplicating or conflicting with `SECURITY_RUNBOOKS.md` — prefer pointer + SEV/escalation table.
