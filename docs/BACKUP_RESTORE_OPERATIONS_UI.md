# Backup & Restore Operations UI (Phase 43f)

**Phase:** 43f  
**Status:** Operations UI complete — **UI + thin API façade only**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)

Operations hub in **clinic-dashboard** for monitoring and initiating backup/restore work. Mirrors Import/Export Center patterns. **No engine algorithms in the UI.** Thin authenticated controllers delegate to existing Job Manager / BackupExecutor / RestoreExecutor / read stores.

Release 42.0 remains frozen. Phases 43a–43e engines remain unchanged.

## Navigation

Settings → **Backup & Restore** (`/settings/backup-restore`)

| Route | Purpose |
|-------|---------|
| `/settings/backup-restore` | Overview — stats, health snippet, CTAs |
| `/settings/backup-restore/jobs` | All jobs — search, filter, sort |
| `/settings/backup-restore/jobs/:jobId` | Job detail — progress, metadata, summaries |
| `/settings/backup-restore/backups` | Backup job list |
| `/settings/backup-restore/backups/new` | New backup request form |
| `/settings/backup-restore/restores` | Restore job list |
| `/settings/backup-restore/restores/new` | New restore request form |
| `/settings/backup-restore/snapshots` | Snapshot metadata (read-only) |
| `/settings/backup-restore/verification` | Verification history |
| `/settings/backup-restore/retention` | Evaluations + cleanup plans |
| `/settings/backup-restore/recovery-points` | Recovery points with `restoreAvailable` |
| `/settings/backup-restore/catalog` | Catalog types + licensing messaging |
| `/settings/backup-restore/health` | Engine readiness |

Region landmark: `#backup-restore-region`

## Workflows

### Backup

1. User with `api.backupRestore:create` opens **New backup**.
2. Selects type (`postgres-logical`, `media-prefix`, or catalog entries), optional target, compression, encryption.
3. Confirms via browser dialog.
4. UI POSTs `/backup-restore/backups` and navigates to job detail.

### Restore

1. User with `api.backupRestore:manage` opens **New restore**.
2. Selects verified recovery point or snapshot, mode (`drill` | `controlled`), optional target kind.
3. Controlled mode requires approver user ID (`api.backupRestore:approve`).
4. Confirms via browser dialog.
5. UI POSTs `/backup-restore/restores` and navigates to job detail.

### Job monitoring

- Jobs dashboard polls while statuses are active (`created`, `queued`, `validating`, `waiting`, `running`, `paused`, `cancelling`, `retrying`).
- Users with `api.backupRestore:manage` can cancel live jobs.

## Permissions

Resource: `api.backupRestore`

| Helper | Action | Typical roles |
|--------|--------|---------------|
| `canViewBackupRestore` | view | owner, general_manager, branch_manager |
| `canCreateBackup` | create | owner, general_manager |
| `canVerify` | update | owner, general_manager |
| `canRestore` / `canManage` | manage | owner |
| `canApproveRestore` | approve | owner |

## Licensing & feature flags

- Tenant gate: `allowBackupRestore` (from effective catalog view).
- Master flag: `BACKUP_RESTORE_CENTER_ENABLED`.
- Upgrade messaging on overview for capabilities not licensed or flags off:
  - `advancedRestore`
  - `scheduledBackup`
  - `crossRegionBackup`
  - `pointInTimeRestore`

## API client

Base path: `/backup-restore`. Uses `@/lib/api-client` `apiRequest` with token + tenantId (same as import-export).

## Observability

UI events log to console as structured JSON with `kind: backup_restore_ui`. Does not duplicate Activity/Audit platforms.

## Known limitations (Phase 43f)

- Queue, worker, and scheduler are not wired — health page reflects this.
- Retention cleanup plans are display-only; no execute button.
- Static catalog is not runtime authority; effective view may return empty types until adapters register.
- E2E tests skip when API is not ready (`isE2eApiReady()`).
- No backup bytes or restore payloads in UI — metadata only.

## File layout

```
apps/clinic-dashboard/src/features/backup-restore/
├── api/
├── components/
├── config/
├── hooks/
├── lib/
├── pages/
├── lazy-backup-restore-routes.tsx
└── backup-restore-layout.module.css
```
