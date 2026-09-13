# D1 — Operator docs inventory

**Lineage:** `1501190+` · **Owner (clarity):** Platform Operations + Docs  
**Phase 50 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths | Status |
|------|-------|--------|
| Phase 49 K3 Backup/Restore | `docs/PHASE_49_K3_BACKUP_RESTORE/` | **PASS-local** |
| Phase 49 K4 Observability | `docs/PHASE_49_K4_OBSERVABILITY_ALERTING/` | **PASS-local** |
| Phase 49 K5 Deploy/Rollback SSOT | `docs/PHASE_49_K5_DEPLOY_ROLLBACK/` (+ `03_SOURCE_INDEX.md`) | **PASS-local** (strongest day-2 hub) |
| Phase 49 K6 Tenant isolation | `docs/PHASE_49_K6_TENANT_ISOLATION/` | **PASS-local** |
| Phase 49 K7 Incident basics | `docs/PHASE_49_K7_INCIDENT_BASICS/00_README.md` | **PASS-local** |
| Phase 49 Kickoff | `docs/PHASE_49_KICKOFF_PACKAGE/` | **PARTIAL** (PA banners stale vs ACCEPTED @ `1501190`) |
| Phase 49 Implementation Review | `docs/PHASE_49_IMPLEMENTATION_REVIEW_PACKAGE/` | **PARTIAL** (README/precheck ACCEPTED; several files still PENDING EXTERNAL) |
| Step 29 Release Readiness | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` | **PASS-local** (does not list Phase 49 K3–K7 in §19) |
| Security runbooks | `docs/SECURITY_RUNBOOKS.md` | **PASS-local** (no back-link to K7/K5) |
| Production migration workflow | `docs/PRODUCTION_MIGRATION_WORKFLOW.md` | **PASS-local** |
| Disaster recovery | `docs/DISASTER_RECOVERY.md` | **PARTIAL** (broad strategy; weak link to K3 cutover SoR) |
| Patient portal ops | `docs/PATIENT_PORTAL_OPS_RUNBOOKS.md` | **PASS-local** (thin; no K5 cross-link) |
| Operations Console | `docs/OPERATIONS_CONSOLE.md`, `docs/OPERATIONS_CONSOLE_RUNBOOKS.md` | **PASS-local** |
| Notification delivery ops | `docs/NOTIFICATION_DELIVERY_OPERATIONS.md` | **PARTIAL** (file wrapped as comment block; weak incident links) |
| Notifications & templates SoR | `docs/NOTIFICATIONS_AND_TEMPLATES.md` | **PARTIAL** (product SoR ≠ day-2 ops) |
| Observability precursors | `docs/SYSTEM_MONITORING_OBSERVABILITY_*.md` | **PARTIAL** (dual with K4; no single on-call front door) |
| Docs-root operator INDEX | `docs/README.md` | **MISSING** |
| Phase 50 kickoff | `docs/PHASE_50_KICKOFF_PACKAGE/` | **PASS-local** (D0 only) |

---

## Themes

1. One-way links: Phase 49 packages → older runbooks; reverse links thin/absent.  
2. Conflicting Phase 49 PA banners (ACCEPTED vs PENDING) confuse operators.  
3. Deploy/incident/backup hardening easy to miss without a front-door INDEX (K5 source index is closest).

---

## Evidence pointers (for D2)

```text
docs/PHASE_49_K5_DEPLOY_ROLLBACK/03_SOURCE_INDEX.md
docs/PHASE_49_K7_INCIDENT_BASICS/00_README.md
docs/SECURITY_RUNBOOKS.md
docs/RELEASE_47_STEP29_RELEASE_READINESS.md §19
docs/DISASTER_RECOVERY.md
docs/NOTIFICATION_DELIVERY_OPERATIONS.md
```
