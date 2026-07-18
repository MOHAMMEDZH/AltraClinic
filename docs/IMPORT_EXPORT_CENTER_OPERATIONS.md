# Import/Export Center — Operations Runbook

**Phase:** 42 (Import/Export Center)  
**Audience:** Platform operators  
**Related:** [`IMPORT_EXPORT_CENTER_ARCHITECTURE.md`](./IMPORT_EXPORT_CENTER_ARCHITECTURE.md), [`RELEASE_42.0.md`](./RELEASE_42.0.md), [`BACKGROUND-ARCHITECTURE.md`](./BACKGROUND-ARCHITECTURE.md)

---

## 1. What this system is

Tenant-scoped orchestration hub for import/export jobs. Business query/transform/validation lives in **adapters** (`users-import`, `users-export`). The hub owns queueing, progress, artifacts metadata, Activity/Audit orchestration, and Notification **Intents** (Phase 41 consume-only).

Queue name: **`import-export`** (never `notification-delivery`).

---

## 2. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `IMPORT_EXPORT_CENTER_ENABLED` | `false` | Master feature flag. When off, job creation/execution is rejected; worker stays idle. |
| `IMPORT_EXPORT_TEMP_PATH` | `cwd/storage/import-export` | Import upload temp root (durable mount required in prod). |
| `IMPORT_EXPORT_ARTIFACT_PATH` | `cwd/storage/import-export/artifacts` | Export artifact root (durable mount required in prod). |
| `MEDIA_VIRUS_SCANNER` | `noop` | Must be non-`noop` before production enablement (OD-3). |
| `BACKGROUND_WORKERS_ENABLED` | (on unless `false`) | Must allow workers for queue processing. |
| `BACKGROUND_SCHEDULERS_ENABLED` | (on unless `false`) | Job expiration + artifact cleanup crons. |

Permissions resource: `api.importExport` (`view` / `create` / `manage` / `export`).  
Licensing: `allowDataImport` / `allowDataExport` from tenant advanced policy.

---

## 3. Deployment sequence

1. Apply Prisma migrations (`20260718010000_phase42c_import_export_job_engine`, `20260718020000_phase42e_export_artifacts`).  
2. `prisma generate`.  
3. Set durable `IMPORT_EXPORT_*_PATH` mounts.  
4. Configure non-noop `MEDIA_VIRUS_SCANNER` for production.  
5. Deploy API with `IMPORT_EXPORT_CENTER_ENABLED=false`.  
6. Verify `GET /import-export/health` (`ready`, `dormant: true`, queue/worker present).  
7. Enable flag for pilot tenant / environment: `IMPORT_EXPORT_CENTER_ENABLED=true`.  
8. Confirm worker logs structured start for queue `import-export`.  
9. Confirm schedulers register (expiration + artifact cleanup).

### Startup order

Redis → API (Prisma) → Background workers → Schedulers → Enable feature flag.

---

## 4. Health checks

`GET /import-export/health` (public readiness probe):

- `featureFlag.enabled`
- `queue.connected` / `queue.name === import-export`
- `worker` status
- `importRuntime` / `exportRuntime` attached adapters
- `expirationScheduler` / `exportRuntime.artifactCleanup`
- `virusScanner.productionReady`
- `registry` / `effectiveView`

Ops UI: Settings → Import / Export → System Health.

---

## 5. Job operations

| Action | API | Permission |
|--------|-----|------------|
| List/filter jobs | `GET /import-export/jobs` | `view` |
| Cancel | `POST /import-export/jobs/{id}/cancel` | `manage` |
| Retry | `POST /import-export/jobs/{id}/retry` | `manage` |
| Import wizard | `/import-export/imports` | `create` |
| Export wizard | `/import-export/exports` | `export` |
| Artifact metadata/download | `GET /import-export/exports/{id}/artifact` | `export` |

**States:** draft → queued → running → completed | completed_with_warnings | failed → retrying → dead_letter | cancelled | expired.

**Retry / DLQ:** Retry engine schedules retries; exhausted attempts → `dead_letter` + Activity + Audit + Notification Intent.

**Correlation:** Every job carries `correlationId`; logs use `kind: import_export`.

---

## 6. Artifacts

Lifecycle: Preparing → Generating → Stored → Available → Expired → Deleted.

- Downloads use hashed download tokens; **no filesystem paths** in API responses.  
- Cleanup scheduler: Available past TTL → Expired; next pass → Deleted + storage delete.  
- Manual/test: `ExportArtifactCleanupScheduler.runOnce()`.

---

## 7. Notifications / Activity / Audit

- Notification Intents only via Phase 41 producer (`export_completed`, `import_completed`, `artifact_available`, failures).  
- Notification failure **never** fails the job (warn + Activity + Audit).  
- Phase 41 delivery engine remains frozen/unmodified.

---

## 8. Rollback

1. Set `IMPORT_EXPORT_CENTER_ENABLED=false`.  
2. Drain/stop `import-export` workers (or restart API with workers disabled).  
3. Leave tables in place (additive).  
4. Legacy domain export/import paths remain unaffected.  
5. Verify health shows `dormant: true` and no new jobs process.

---

## 9. Recovery

| Symptom | Action |
|---------|--------|
| Queue stuck | Check Redis; worker health; requeue via retry API for failed jobs |
| DLQ growth | Inspect `import_export_dead_letters`; fix adapter/config; retry eligible jobs |
| Artifact download fails | Check status Available + token + RBAC; run cleanup metrics |
| Storage missing files | Restore durable volume; do not recreate keys from API paths |
| Malware false positives | Review scanner config; job failed with malware reason is terminal |

---

## 10. Known limitations

- Local disk `ArtifactStoragePort` / temp storage until object-storage provider is wired.  
- Production virus scanner must be configured (NoOp is for non-prod).  
- Only first-party adapters in v1: `users-import`, `users-export`.  
- Health endpoint is public readiness (no PHI); job APIs require auth.

---

## 11. UI

Clinic dashboard: `/settings/import-export` (Overview, Imports, Exports, Jobs, Catalog, Artifacts, Health).
