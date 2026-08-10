# Backup Engine (Phase 43c)

**Phase:** 43c  
**Status:** Backup Engine complete — **backup execution only**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)  
**Job Engine:** [`BACKUP_RESTORE_JOB_ENGINE.md`](./BACKUP_RESTORE_JOB_ENGINE.md)

No restore, retention, verification execution, schedulers, workers, or queue consumers.

---

## Backup pipeline

Deterministic stages (`BACKUP_PIPELINE_STAGES`):

1. validate_job  
2. load_policy  
3. resolve_target  
4. prepare_snapshot  
5. collect_data  
6. compress  
7. encrypt  
8. write_backup  
9. generate_manifest  
10. register_snapshot  
11. queue_verification_request  
12. finalize_job  

Progress is pushed to the Job Engine via `updateProgress` (phase, percent, step/stepCount, status message).

---

## Backup executor

`BackupExecutor` (`application/backup.executor.ts`):

- Starts/leases the job through `BackupRestoreJobManager` (no Job Engine redesign)
- Runs the pipeline
- Registers snapshot metadata
- Creates **pending** verification requests only
- Maps failures to Job Engine failure classes
- Emits Activity / Audit / notification intent registrations

Entry: `executeBackup({ tenantId, jobId, leaseOwner })`.

---

## Snapshot model

`BackupSnapshotRecord` includes: id, backupJobId, tenant, checksum, size, compression, encryption, storageKey, storageProvider, manifest, verificationStatus (`pending`|`skipped`), recoveryPointId, timestamps.

---

## Manifest

Schema `43c.1` with resources, entity counts, compression/encryption metadata, key reference/version (never raw secrets), backup metadata.

---

## Storage abstraction

Port `BackupStoragePort` with provider kinds: `filesystem` | `s3` | `azure_blob` | `gcs` | `custom` | `memory`.

**43c implementation:** `MemoryBackupStorageProvider` (default). Cloud SDKs not wired. Interface ready for later providers per SSOT.

---

## Compression orchestration

`GzipCompressionOrchestrator` — Node `zlib.gzipSync` only. Records algorithm, level, input/output bytes.

---

## Encryption orchestration

`EnvelopeEncryptionOrchestrator` — Node `crypto` AES-256-GCM envelope.  
Key material via `BACKUP_RESTORE_ENCRYPTION_KEY_REF` → env var **name** (no secrets in code). No KMS.

---

## Failure handling

| Condition | Failure class |
|-----------|---------------|
| Missing encryption key | ConfigurationFailure |
| Bad request / validation | ValidationFailure |
| Storage errors | StorageFailure |
| Other | SystemFailure |

---

## Verification request

Creates `BackupVerificationRequest` with `status: 'pending'` only. **No verify execution** (Phase 43d).

---

## Extension points

- Storage providers implementing `BackupStoragePort`
- Data collectors per `typeId` / target kind
- Policy loader overrides via job metadata

---

## Forbidden (absent)

Restore engine · retention · verification execution · scheduler · workers · queue consumers · restore APIs/UI
