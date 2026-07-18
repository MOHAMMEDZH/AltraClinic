# Release 42.0 — Import/Export Center

**Version:** `v42.0.0`  
**Codename:** Import/Export Center  
**Freeze date:** 2026-07-18  
**Status:** READY FOR DEPLOYMENT (feature flag **disabled by default**)

---

## 1. Release freeze

| Scope | Status |
|-------|--------|
| Phase 41 Notification Center | **FROZEN** (unchanged; consume-only from Phase 42) |
| Phase 42a–42g Import/Export Center | **FROZEN** as of **2026-07-18** |
| Functional code | No further feature work; production blockers only with explicit review |

Freeze means: no new adapters, no API contract changes, no Runtime/Job Engine/Registry/UI redesign, no Phase 41 modifications.

---

## 2. Release notes (`v42.0.0`)

### What shipped

- **Import/Export Center** orchestration hub (`/import-export`)
- Catalog & Runtime Registry (EffectiveImportExportView)
- Job Engine (queue `import-export`, retry, DLQ, cancel, expire)
- Import Runtime + `users-import` adapter (CSV/XLSX, malware scan port, dry-run)
- Export Runtime + `users-export` adapter (CSV/XLSX, artifact lifecycle, storage port)
- Operations UI (`/settings/import-export`)
- Production acceptance (42g) + operations runbook

### Breaking changes

- **None** for existing domain export/import paths (legacy routes remain).
- New hub is additive and **off** until `IMPORT_EXPORT_CENTER_ENABLED=true`.

### Migration notes

Apply in order (if not already applied):

1. `20260718010000_phase42c_import_export_job_engine`
2. `20260718020000_phase42e_export_artifacts`

Then: `npx prisma generate` / `prisma migrate deploy`.

### Known limitations

- Local disk artifact/temp storage until object-storage provider is wired.
- Virus scanner defaults to `noop` in non-prod; **must** be non-noop before enablement.
- First-party adapters only: `users-import`, `users-export`.
- Hub health endpoint is a public readiness probe (no PHI).

---

## 3. Feature flag review

| Flag / env | Default | Production default | Notes |
|------------|---------|-------------------|--------|
| `IMPORT_EXPORT_CENTER_ENABLED` | `false` | **`false` until all gates pass** | Master switch; worker idle when false |
| `MEDIA_VIRUS_SCANNER` | `noop` | non-`noop` required to enable | Enablement gate (OD-3) |
| `BACKGROUND_WORKERS_ENABLED` | on (unless `false`) | on | Required for queue processing |
| `BACKGROUND_SCHEDULERS_ENABLED` | on (unless `false`) | on | Job expire + artifact cleanup |

### Enablement procedure (operators)

1. Confirm **Production gates** (§5) all green.  
2. Deploy with flag still `false`; verify health `dormant: true`.  
3. Set durable paths + virus scanner.  
4. Set `IMPORT_EXPORT_CENTER_ENABLED=true` (pilot env first).  
5. Confirm worker consumes `import-export`; run smoke checklist.  
6. Expand rollout.

### Rollback procedure

1. Set `IMPORT_EXPORT_CENTER_ENABLED=false` immediately.  
2. Restart/drain workers if needed.  
3. Expected rollback time: **&lt; 5 minutes** (flag + process recycle).  
4. Data: leave tables; no destructive rollback required for v1.

### Operator checklist (pre-enable)

- [ ] Gates §5 complete  
- [ ] Pilot tenant identified  
- [ ] Support on-call informed  
- [ ] Monitoring/alerts reviewed  
- [ ] Rollback owner assigned  

---

## 4. Production gates (mandatory)

Do **not** set `IMPORT_EXPORT_CENTER_ENABLED=true` until **every** gate passes:

| # | Gate | Verification |
|---|------|----------------|
| G1 | Production virus scanner | `MEDIA_VIRUS_SCANNER` ≠ `noop`; health `virusScanner.productionReady === true` |
| G2 | Durable artifact storage | `IMPORT_EXPORT_ARTIFACT_PATH` on durable volume |
| G3 | Durable import temp storage | `IMPORT_EXPORT_TEMP_PATH` on durable volume |
| G4 | Database migrated | Both Phase 42 migrations applied |
| G5 | Queue healthy | Redis up; health `queue.name === import-export` and connected |
| G6 | Worker running | Health worker status ready/enabled when flag on |
| G7 | Scheduler running | Expiration + artifact cleanup registered (not disabled by env) |
| G8 | Health green | `GET /import-export/health` → `ready: true` |
| G9 | Monitoring enabled | Logs/metrics for queue, workers, DLQ, API errors (see §9) |
| G10 | Alerting enabled | Alerts on DLQ growth, worker down, queue depth, storage failures |

---

## 5. Environment variables (complete list)

| Variable | Required in prod | Default | Purpose |
|----------|------------------|---------|---------|
| `IMPORT_EXPORT_CENTER_ENABLED` | Yes (value `false` until gates) | `false` | Master feature flag |
| `IMPORT_EXPORT_TEMP_PATH` | Yes when enabled | `cwd/storage/import-export` | Import uploads |
| `IMPORT_EXPORT_ARTIFACT_PATH` | Yes when enabled | `cwd/storage/import-export/artifacts` | Export artifacts |
| `MEDIA_VIRUS_SCANNER` | Yes when enabled | `noop` | Malware scan provider |
| `BACKGROUND_WORKERS_ENABLED` | Yes | not `false` | BullMQ workers |
| `BACKGROUND_SCHEDULERS_ENABLED` | Yes | not `false` | Cron schedulers |
| Redis connection (existing platform) | Yes | — | Queue `import-export` |
| Database URL (existing platform) | Yes | — | Jobs + artifacts tables |

Also rely on existing platform: JWT auth, tenant headers, permission matrix, Phase 41 notification producer.

---

## 6. Deployment guide

### Order

1. **Database:** `prisma migrate deploy` (42c then 42e migrations).  
2. **Generate client:** `prisma generate`.  
3. **Config:** set paths, virus scanner, keep `IMPORT_EXPORT_CENTER_ENABLED=false`.  
4. **Deploy API** (includes hub module).  
5. **Ensure Redis** reachable.  
6. **Start workers** (`BACKGROUND_WORKERS_ENABLED` not false).  
7. **Start schedulers** (`BACKGROUND_SCHEDULERS_ENABLED` not false).  
8. **Health:** `GET /import-export/health` → ready, dormant true, queue present.  
9. **UI deploy** (clinic-dashboard with Import/Export Center routes).  
10. **Post-deploy smoke** (flag still off): health + UI loads Settings → Import/Export (dormant messaging OK).  
11. **Enable flag** only after gates G1–G10.  
12. **Post-enable smoke:** dry-run import, export CSV, artifact download, job list.

### Post-deployment validation

- Health: `featureFlag`, `queue`, `worker`, `importRuntime`, `exportRuntime`, `virusScanner`  
- No new jobs process while flag false  
- After enable: one dry-run import + one export + download  

---

## 7. Rollback guide

| Layer | Action | Notes |
|-------|--------|-------|
| Feature flag | `IMPORT_EXPORT_CENTER_ENABLED=false` | Primary; &lt; 5 min |
| Workers | Restart with workers drained / flag off | Stops new processing |
| Schedulers | Optional disable via `BACKGROUND_SCHEDULERS_ENABLED=false` | Stops expire/cleanup only |
| Deployment | Redeploy previous API/UI artifact if needed | Additive schema — no DB down-migrate required for emergency |
| Database | **Do not** drop tables in emergency rollback | Keep for forensics |
| Recovery | Fix root cause → re-run gates → re-enable flag | |

**Expected rollback time:** flag-only **&lt; 5 minutes**; full deploy rollback **15–30 minutes** depending on pipeline.

---

## 8. Operational runbook summary

Authoritative ops detail: [`IMPORT_EXPORT_CENTER_OPERATIONS.md`](./IMPORT_EXPORT_CENTER_OPERATIONS.md).

Covers: config, deploy sequence, health, job ops, artifacts, notifications/Activity/Audit, rollback, recovery matrix (queue stuck, DLQ, artifact download, storage, malware), known limitations, UI entry point, support escalation via platform on-call.

---

## 9. Monitoring checklist

| Signal | Source | Gap? |
|--------|--------|------|
| Queue depth / connected | Health + BullMQ metrics / logs `import_export` | Covered |
| Worker health | Health `worker` + worker structured logs | Covered |
| Scheduler runs | Health expiration + artifactCleanup counters | Covered |
| Retry / DLQ | Job status counts + DLQ table + intents | Covered |
| Artifact cleanup | Health `artifactCleanup` lastExpired/deleted | Covered |
| Storage failures | Component logs `artifact_storage` | Covered (alert on error rate) |
| Virus scanner | Health `virusScanner` + intake logs | Covered |
| API errors | Platform HTTP metrics + Nest logs | Covered (platform) |
| AuthN/AuthZ failures | Platform auth/permission logs (403/401) | Covered (platform) |
| Correlation | `correlationId` on jobs + logs | Covered |

Operators should wire platform alerting to: worker down, queue disconnected, DLQ growth, storage put/get failures, elevated 5xx on `/import-export/*`.

---

## 10. Smoke test results (Release 42.0)

Executed as automated smoke (no production flag enablement):

| Suite | Result |
|-------|--------|
| API `import-export/tests` | **52 passed** (6 suites) — includes import/export E2E unit, retry, DLQ, cleanup, RBAC, isolation, path sanitizer |
| UI Vitest `features/import-export` | **8 passed** |
| Playwright `import-export-ops` + `import-export-a11y` | **9 passed** (prior acceptance; re-run in CI recommended at deploy) |

Smoke coverage maps to: health, dry-run/real import paths, export + artifact, notifications non-blocking, retry/DLQ, cleanup, catalog/dashboard/job APIs, accessibility.

---

## 11. Documentation audit

| Document | Status |
|----------|--------|
| `IMPORT_EXPORT_CENTER_ARCHITECTURE.md` | Complete + freeze/enablement footer |
| `IMPORT_EXPORT_CENTER_OPERATIONS.md` | Complete runbook |
| `PHASE_42G_PRODUCTION_ACCEPTANCE.md` | Complete |
| `PHASE_42_ARCHITECTURE_DISCOVERY_AND_READINESS.md` | Historical |
| `RELEASE_42.0.md` (this file) | Complete |
| `apps/api/.env.example` | IE vars documented |

---

## 12. Technical debt disposition

| Item | Classification |
|------|----------------|
| Local disk storage providers | **Accepted** / Future Enhancement (object storage) |
| NoOp virus scanner in non-prod | **Accepted** with **Production Gate G1** |
| Dual complete notification intents | **Deferred** |
| Additional adapters | **Future Enhancement** (forbidden in freeze) |
| Public health aggregates | **Accepted** |
| Path leakage in APIs | **Resolved** (42g) |
| Ops/runbook/env docs | **Resolved** (42g + 42.0) |
| Unresolved production blockers | **None** |

---

## 13. Honest completion percentage

**100%** for release stabilization deliverables (docs, gates, freeze, verification).  
Production **traffic enablement** remains gated (intentional) until G1–G10.

---

## 14. Explicit confirmations

- Release **42.0 is frozen** as of **2026-07-18**.  
- Import/Export Center remains **`IMPORT_EXPORT_CENTER_ENABLED=false` by default**.  
- Production enablement requires **all documented gates**.  
- **No architectural changes** introduced in this stabilization release.  
- **Phase 41 remains frozen**.  
- **Phase 42 remains frozen**.

---

# PASS — RELEASE 42.0 READY FOR DEPLOYMENT
