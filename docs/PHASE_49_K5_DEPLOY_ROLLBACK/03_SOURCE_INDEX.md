# K5 — Source Index

Pointers only — authoritative detail remains in linked docs.

| Topic | Path | Role for K5 |
|-------|------|-------------|
| Step 29 release readiness / cutover | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` | Cutover gates, D-17, ownership §§7–14, deploy/rollback checklist §12 |
| Production migration workflow | `docs/PRODUCTION_MIGRATION_WORKFLOW.md` | Forward-fix preference; migrate/RLS/triggers commands |
| Migration strategy (broader) | `docs/MIGRATION_STRATEGY.md` | Context for baseline / legacy SQL |
| Security runbooks | `docs/SECURITY_RUNBOOKS.md` | Incident escalation; Release Manager; CSP §11 |
| Operations console runbooks | `docs/OPERATIONS_CONSOLE_RUNBOOKS.md` | Ops console day-2 (not deploy engine) |
| Patient portal ops + rollback | `docs/PATIENT_PORTAL_OPS_RUNBOOKS.md` | Portal-scoped deploy/rollback notes |
| Disaster recovery | `docs/DISASTER_RECOVERY.md` | Restore path / RTO-RPO ops ownership |
| Phase 49 K3 backup/restore | `docs/PHASE_49_K3_BACKUP_RESTORE/` | Cutover backup SoR + drill posture |
| Phase 49 K4 observability | `docs/PHASE_49_K4_OBSERVABILITY_ALERTING/` | Health/metrics surfaces for post-deploy verify |
| Phase 49 K1 deploy inventory | `docs/PHASE_49_K1_DISCOVERY_INVENTORY/04_DEPLOY_ROLLBACK_INVENTORY.md` | Gap that K5 closes (unified SSOT) |
| Phase 47 D-17 | `docs/PHASE_47_EXECUTION_PLAN.md` (D-17) | Deploy topology deferred to Step 29 / external |
| CI workflows | `.github/workflows/*` | **Regression / merge readiness — not CD** |

## CI vs deploy (boundary)

```text
CI green  →  may merge / may propose release SHA
CD / host deploy  →  EXTERNAL (D-17); not invented in this package
Step 29 onepass  →  release readiness regression; not a production deployer
```
