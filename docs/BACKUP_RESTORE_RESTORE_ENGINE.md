# Restore Engine (Phase 43e)

**Phase:** 43e  
**Status:** Restore Engine complete — **restore execution from verified snapshots only**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)  
**Backup Engine:** [`BACKUP_RESTORE_BACKUP_ENGINE.md`](./BACKUP_RESTORE_BACKUP_ENGINE.md)  
**Verification & Retention:** [`BACKUP_RESTORE_VERIFICATION_RETENTION.md`](./BACKUP_RESTORE_VERIFICATION_RETENTION.md)

No scheduler, workers, queue consumers, cleanup execution, snapshot deletion, or UI.

---

## Restore lifecycle

```
created → queued → running → (pipeline stages) → completed | failed
```

Job Engine statuses are used unchanged. RestoreExecutor leases the job, pushes progress, and marks completed/failed.

---

## Restore pipeline

Deterministic stages (`RESTORE_PIPELINE_STAGES`):

1. validate_restore_request  
2. load_snapshot  
3. validate_verification_status  
4. resolve_recovery_point  
5. load_manifest  
6. validate_restore_target  
7. prepare_restore  
8. restore_data  
9. validate_restore  
10. finalize_restore  
11. complete_job  

Illegal Job Engine transitions remain rejected by the existing state machine.

---

## Restore executor

`RestoreExecutor.executeRestore(...)`:

- Accepts `kind=restore` jobs only  
- Requires **VERIFIED** snapshots (`verificationStatus === 'passed'`)  
- Decrypts / decompresses logical backup payload  
- Writes logical scratch destination (drill / controlled target key)  
- Persists `RestoreResultRecord`  
- Does **not** modify backup snapshots or run cleanup  

Modes:

| Mode | Target defaults | Dual-control |
|------|-----------------|--------------|
| `drill` | `temporary_validation` / sandbox | Not required |
| `controlled` | `original` / alternate | Requester ≠ `approvedByUserId` when `dualControlRestore` |

---

## Recovery point selection

`RestoreRecoveryPointResolver` supports:

- `latest_verified`  
- `explicit_recovery_point` (`metadata.recoveryPointId`)  
- `snapshot_identifier` (`metadata.snapshotId`)  

Rejects missing / cross-tenant / mismatched recovery points.

---

## Restore validation

`RestoreValidator` checks license gate, permissions, feature flags, tenant ownership, verification status, manifest validity, storage availability, and restore policy (dual-control).

---

## Restore targets

`RestoreTargetResolver`: `original`, `alternate`, `tenant_sandbox`, `temporary_validation`, `custom`.  
Drill cannot target `original`; controlled cannot use `temporary_validation`.

---

## Failure handling

Failures map to Job Engine classes: Validation / Permission / License / Configuration / Storage / Verification / System.

---

## Extension points

- Additional restore target kinds  
- Live Postgres / Media adapters (later phase; 43e is logical scratch)  
- Scheduler / workers (explicitly out of scope)

---

## Forbidden (absent)

Scheduler · cron · workers · queue consumers · cleanup execution · snapshot deletion · UI · backup/verify engine redesign
