# K1 — Deploy / Rollback Inventory

**Lineage:** `9eac595+` · **Owners:** Platform Operations (topology); Release Manager (rollback authorization) — Step 29 §8  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Step 29 release readiness / cutover | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` (topology D-17 external; rollback hybrid) | **PARTIAL** (authoritative cutover; not a single day-2 ops SSOT) |
| Production migration workflow | `docs/PRODUCTION_MIGRATION_WORKFLOW.md` (forward-fix preferred) | **PASS-local** |
| Security runbooks (release-blocking / CSP) | `docs/SECURITY_RUNBOOKS.md` §§10–11 | **PASS-local** |
| Patient portal ops + rollback | `docs/PATIENT_PORTAL_OPS_RUNBOOKS.md` | **PASS-local** (portal-scoped) |
| Notification delivery ops | `docs/NOTIFICATION_DELIVERY_OPERATIONS.md` (referenced from notification architecture) | **PARTIAL** |
| Super Admin rollback notes | Scattered (e.g. MFA/session, tenant directory docs) | **PARTIAL** |
| Wave review “rollback” sections | Phase 48 wave packages (product correction rollback ≠ deploy rollback) | **PARTIAL** (wrong layer for Phase 49 deploy SSOT) |
| In-repo prod Docker/k8s deploy | None (D-17 external) | **MISSING** in-repo (expected) |
| Unified Production Hardening deploy/rollback SSOT | — | **MISSING** |
| CI workflows (build/test, not deploy) | `.github/workflows/clinic-dashboard-ci.yml`, `super-admin-ci.yml`, `phase28-licensing-ci.yml`, `platform-db-security-ci.yml`, `phase48-pack-matrix.yml` | **PASS-local** as regression; **not** deploy pipelines |

---

## Evidence pointers

```text
docs/RELEASE_47_STEP29_RELEASE_READINESS.md
docs/PRODUCTION_MIGRATION_WORKFLOW.md
docs/SECURITY_RUNBOOKS.md
docs/PATIENT_PORTAL_OPS_RUNBOOKS.md
docs/DISASTER_RECOVERY.md (restore path)
.github/workflows/*
```

---

## Gaps (for K5)

1. No single Phase 49 **deploy + rollback runbook SSOT** that operators can follow end-to-end (topology is external).
2. Product-feature rollback docs ≠ release artifact rollback.
3. CI proves merge readiness; does not deploy — Phase 49 must document boundary clearly.
4. Cutover gates still “pending execution” at production time (Step 29) — Phase 49 should package checklist, not claim cutover done.
