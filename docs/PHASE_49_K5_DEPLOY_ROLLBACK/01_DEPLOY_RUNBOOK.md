# K5 — Deploy Runbook (day-2 operator path)

**Owners:** Platform Operations (Deploy); Database/Backup Operator (migrations); Release Manager (cutover authorization)  
**SoR for cutover gates:** `docs/RELEASE_47_STEP29_RELEASE_READINESS.md` §§7–14  
**Phase 49 claim:** packaging only — does **not** execute or claim a production cutover

---

## 1. Preconditions

Before any production-facing release attempt:

| Gate | Expectation | Owner |
|------|-------------|--------|
| Green CI baselines | Agreed PR/merge checks green on the release SHA (clinic-dashboard, super-admin, platform-db-security, licensing, Wave packs as applicable) | Platform Operations |
| Step 28 / Step 29 regression | Prefer recent green `test:step28-*` / `test:step29-release-final-onepass` on accepting lineage — **CI proves readiness, does not deploy** | Platform Operations |
| Migrations reviewed | `prisma migrate status` on staging clone; no surprise pending migrations | Database/Backup Operator |
| Pre-deploy backup | Step 29 §9 + K3 cutover SoR (`backup-postgres.*` → `verify-backup.sh`) | Database/Backup Operator |
| Secrets / config | Phase 49 K2 hygiene + Platform Security review | Platform Security |
| Topology (D-17) | Actual external topology **recorded** (not invented in-repo) | Platform Operations |
| On-call / alerts | Step 29 §11 + K4 readiness map; external paging path confirmed or Release Manager written waiver | Platform Security on-call |
| Access review | Step 29 §13 least-privilege | Release Manager + Platform Security |

```text
Step 29 acceptance ≠ production deploy authorization
Unmet cutover gates = BLOCK production
```

---

## 2. Forward-fix preference (migrations)

Authoritative workflow: `docs/PRODUCTION_MIGRATION_WORKFLOW.md`.

1. Prefer **forward-fix** migrations over destructive DB rollback.
2. Production apply path (repository-owned commands; host is external):

```bash
cd apps/api
npm run db:migrate:deploy
npm run db:rls:apply
npm run db:triggers:apply
```

3. Test every migration on a **staging clone** before production.
4. Prisma does **not** auto-rollback — see [02_ROLLBACK_RUNBOOK.md](./02_ROLLBACK_RUNBOOK.md) for honest limits.
5. After migrate: confirm `prisma migrate status` clean; app boot; tenant-scoped smoke.

---

## 3. External topology boundary (Step 29 D-17)

| In-repo | External (must exist outside repo) |
|---------|--------------------------------------|
| Migration commands, health endpoints, backup/restore scripts, RBAC | Prod hosts / containers / load balancers / ingress |
| Release readiness checklists (Step 29) | Artifact registry, image tags, deploy tooling |
| CI workflows (build/test) | CD pipeline, secrets vault wiring to hosts |
| Observability HTTP surfaces (K4) | Metrics scrape, APM, alert → pager (if any) |

**Do not** add k8s/helm/terraform “to look complete.” Platform Operations records the **actual** topology at cutover (Step 29 §10).

---

## 4. High-level release order (no cluster manifests)

Order is logical; exact mechanism is external:

```text
1. Freeze release SHA + confirm green CI baselines
2. Pre-deploy backup + verify (K3 / Step 29 §9)
3. Database: migrate:deploy → rls:apply → triggers:apply
4. API / backend service deploy (Platform Operations)
5. Clinic dashboard / Super Admin / portal frontends (as in release set)
6. Verify health: GET /health/live, /health/ready, /health (see K4 surface map)
7. Smoke: auth boundary, one EER/limit path, audit write
8. Confirm monitoring/on-call path (external) or RM waiver
9. Handover note to support (Platform Admin + Operations)
```

**Notifications:** no real external sends unless Release Manager authorized (Step 29 §12).

---

## 5. Post-deploy verification (minimum)

| Check | Pointer |
|-------|---------|
| Liveness / readiness | `/health/live`, `/health/ready` — K4 `01_SURFACE_MAP.md` |
| Aggregate health | `/health` |
| Metrics (if scraped) | `/metrics` — scrape itself is EXTERNAL |
| Auth / entitlement smoke | Step 29 §12 post-deploy |
| Audit append | Platform Security |

Failure of health or cutover-gated smoke → escalate to Release Manager; consider rollback per [02_ROLLBACK_RUNBOOK.md](./02_ROLLBACK_RUNBOOK.md).
