# Backup & Restore Job Engine (Phase 43b)

**Phase:** 43b  
**Status:** Job Engine complete — **orchestration only**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)  
**Foundation:** [`BACKUP_RESTORE_CENTER_FOUNDATION.md`](./BACKUP_RESTORE_CENTER_FOUNDATION.md)

No backup/restore execution, schedulers, workers, or queue consumers.

---

## Job lifecycle (summary)

```
created → queued → validating → waiting → running ⇄ paused
                         ↓
              verification_pending → verified
                         ↓
                    completed | failed → retrying → queued
                         ↓
              cancelling → cancelled | dead_letter | expired
```

Terminal: `cancelled`, `dead_letter`, `expired` (and effectively `verified` / `completed` until expiry).

---

## State machine

File: `domain/job/backup-restore-job-state-machine.ts`

- Transition table `BACKUP_RESTORE_JOB_TRANSITIONS`
- `assertBackupRestoreJobTransition` rejects illegal moves
- Every successful transition appends `{ from, to, at, actorId }` on the job
- Cancellable statuses: created, queued, validating, waiting, running, paused, retrying, verification_pending

---

## Job Manager

`BackupRestoreJobManager` (`application/backup-restore-job.manager.ts`):

| Method | Purpose |
|--------|---------|
| `createJob` | Validate flag/RBAC/license/config/catalog/metadata; idempotent create |
| `markQueued` | Status → queued (**no BullMQ**) |
| `startJob` | Logical lease + running (via validating when needed) |
| `pauseJob` / `resumeJob` | Pause/resume |
| `updateProgress` | Progress tracking only |
| `markCompleted` / `markVerified` | Completion / verify metadata |
| `markFailed` | Failure class + optional retry/DLQ |
| `scheduleRetry` | Retry metadata only |
| `cancelJob` | User/system/license/feature_flag/dependency reasons |
| `expireJob` / `expireDueJobs` | TTL expiry |
| `getJob` / `listJobs` / `getEngineHealth` | Read + health |

---

## Validation rules

Before create:

1. `BACKUP_RESTORE_CENTER_ENABLED=true`
2. RBAC `api.backupRestore` (create/manage)
3. `allowBackupRestore` tenant license
4. Configuration defaults sane
5. Catalog `typeId` known
6. Required metadata (restore requires `snapshotId`)
7. Ownership via `ownerUserId` / initiator
8. Duplicate active job for same kind+target rejected

---

## Logical locking

- Lease: `leaseOwner` + `leasedAt` on start
- Reject second lease owner while running
- Duplicate active job guard via `findActiveByKindTarget`
- Double cancel / double complete are idempotent no-ops
- **Not** a distributed lock implementation

---

## Progress model

`progress: { percent, phase, step, stepCount, statusMessage, updatedAt }`

Updated by manager; no execution metrics.

---

## Retry model

`BackupRestoreRetryEngine.decide`:

- Eligible while `attemptCount < maxAttempts`
- Exponential delay metadata (`baseDelayMs * 2^(n-1)`, capped)
- Else dead-letter record
- **No retry worker**

---

## Cancellation

Reasons: `user` | `system` | `license` | `feature_flag` | `dependency_failure`

Preserves transition history + audit + activity.

---

## Failure model

Classes: `ValidationFailure`, `PermissionFailure`, `LicenseFailure`, `ConfigurationFailure`, `StorageFailure`, `VerificationFailure`, `SystemFailure`, `UnknownFailure`

Classification stored on job; no recovery engine.

---

## Repository

`InMemoryBackupRestoreJobRepository` — job metadata, transitions, progress, retry/cancel/failure fields, DLQ rows.

No backup payload / artifact bytes. Durable Prisma persistence deferred (no migration in 43b).

---

## Integrations

| Concern | Behavior |
|---------|----------|
| Activity | Emitter for lifecycle events |
| Audit | `BackupRestoreAuditLog` via Audit platform |
| Notification | Intent **registrar** only (`deliveryWired: false`) |
| Health | `jobEngine.ready`, repository/config/flag readiness |
| Observability | Transition/retry/failure hooks + structured logs + correlation IDs |

---

## Extension points

- Catalog `typeId` registrations (still non-executable)
- Failure classes / cancel reasons
- Retry policy fields on job
- Future queue/worker bind to `markQueued` / `startJob` without redesigning the state machine

---

## Forbidden (confirmed absent)

Backup/restore engines · schedulers · cron · workers · queue consumers · cloud/FS storage adapters · encryption/compression/verify/retention execution · UI · business REST beyond health.
