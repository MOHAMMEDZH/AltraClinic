# Backup & Restore Center — Developer Foundation Guide (Phase 43a)

**Phase:** 43a  
**Status:** Foundation complete — **no execution**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)

This document describes the **developer-facing** foundation only. Operational runbooks arrive in later phases.

---

## Module structure

```
apps/api/src/modules/backup-restore/
  backup-restore.module.ts          # Nest registration
  backup-restore.constants.ts       # Flags, permissions, events, intents
  config/backup-restore-config.ts   # Defaults + flag loaders
  controllers/backup-restore-health.controller.ts
  catalog/static-backup-restore.catalog.ts
  domain/                           # Entities + value objects (shapes only)
  application/
    *-contracts.ts                  # Activity / Audit / Notification / Licensing / Observability
    backup-restore-extension.registry.ts
    backup-restore-health.contributors.ts
    effective-backup-restore-view.service.ts
    null-backup-restore.services.ts
    ports/repositories.ts           # Repository interfaces only
    ports/services.ts               # Service interfaces only
  tests/backup-restore-foundation.spec.ts
```

Registered in `AppModule` as `BackupRestoreModule`.

---

## Domain model

Entities (TypeScript interfaces — no behavior):

| Entity | Purpose |
|--------|---------|
| `BackupJob` | Lifecycle instance of a backup run |
| `BackupSnapshot` | Artifact metadata (checksum, storage key) |
| `RestoreJob` | Drill or controlled restore run |
| `BackupPolicy` | Cadence, targets, encryption, verify flag |
| `RetentionPolicy` | Retain-for + floor count |
| `BackupTarget` | postgres / media / script_bridge |
| `RestoreRequest` | Dual-control request record |
| `BackupVerification` | Verify outcome |
| `RecoveryPoint` | Labeled recovery marker |

Value objects: statuses, modes, encryption/compression classes, tenant + correlation context.

---

## Repository contracts

Injection tokens + interfaces in `application/ports/repositories.ts`:

- `BackupJobRepository`
- `SnapshotRepository`
- `RestoreJobRepository`
- `PolicyRepository`
- `RetentionPolicyRepository`
- `TargetRepository`
- `RestoreRequestRepository`
- `VerificationRepository`
- `RecoveryPointRepository`

**No Prisma (or other) implementations in 43a.**

---

## Service contracts

Tokens + interfaces in `application/ports/services.ts`:

- `BackupService`
- `RestoreService`
- `VerificationService`
- `RetentionService`
- `EncryptionService`
- `CompressionService`
- `TargetResolver`

DI uses `Null*` holders with `contractVersion: '43a'` only — **no execute methods**.

---

## Configuration

| Env | Default | Role |
|-----|---------|------|
| `BACKUP_RESTORE_CENTER_ENABLED` | `false` | Master flag (SSOT) |
| `BACKUP_CENTER_ENABLED` | `false` | Sub-flag (registered) |
| `BACKUP_RESTORE_ENABLED` | `false` | Sub-flag |
| `BACKUP_VERIFY_ENABLED` | `false` | Sub-flag |
| `BACKUP_SCHEDULER_ENABLED` | `false` | Sub-flag |
| `BACKUP_RESTORE_DEFAULT_RETENTION_DAYS` | `30` | Default retention |

Defaults also register: compression `gzip`, encryption class `envelope`, max concurrent jobs `1`, chunk size 8 MiB, verify-after-backup `true`, dual-control restore `true`, storage provider `unconfigured`.

Queue name **`backup-restore`** is reserved; **not wired** in 43a.

---

## Permissions

Resource: `api.backupRestore`

| Logical (architecture / brief) | Matrix action |
|--------------------------------|---------------|
| policy/job read, backup.view | `view` |
| job.run, backup.create | `create` |
| policy.write, backup.verify | `update` |
| backup.delete | `delete` |
| restore.approve | `approve` |
| artifact.download | `export` |
| restore.execute, backup.manage / restore | `manage` |

Health: `GET /backup-restore/health` (public readiness; matrix notes `view`).

---

## Licensing

- Tenant gate: `allowBackupRestore` on `TenantAdvancedPolicyConfig` (**default false**).
- Capability ids (registry only): `backupCenter`, `scheduledBackup`, `advancedRestore`, `crossRegionBackup`, `pointInTimeRestore`.

No LicensingEngine redesign.

---

## Feature flags

All default **false**. Master enablement is `BACKUP_RESTORE_CENTER_ENABLED`.

---

## Extension points

- Extension kind: `backupRestore` (local registry; Module Registry package unchanged).
- Static catalog: disabled/inactive entries; `STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY = false`.
- Effective view: always empty `types` while dormant / non-executable.

---

## Integrations (contracts only)

| Platform | Registration |
|----------|--------------|
| Activity | Event name list — no emit |
| Audit | Action name list — no emit |
| Notification | Intent kind list — no send |
| Health | Contributor definitions + dormant `/backup-restore/health` |
| Observability | Metric names, log/trace namespaces, correlation field — no recording |

---

## Forbidden in 43a (and not present)

Backup/restore engines · schedulers · cron · workers · queues · storage adapters · encryption/compression implementations · verification/retention execution · UI · business REST APIs beyond health.

---

## Phase 43b

Job Engine documentation: [`BACKUP_RESTORE_JOB_ENGINE.md`](./BACKUP_RESTORE_JOB_ENGINE.md)

## Phase 43c

Backup Engine documentation: [`BACKUP_RESTORE_BACKUP_ENGINE.md`](./BACKUP_RESTORE_BACKUP_ENGINE.md)

## Phase 43d

Verification & Retention documentation: [`BACKUP_RESTORE_VERIFICATION_RETENTION.md`](./BACKUP_RESTORE_VERIFICATION_RETENTION.md)


