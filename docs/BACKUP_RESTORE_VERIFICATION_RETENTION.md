# Verification & Retention (Phase 43d)

**Phase:** 43d  
**Status:** Verification & Retention complete — **verify + plan only**  
**Architecture SSOT:** [`BACKUP_RESTORE_CENTER_ARCHITECTURE.md`](./BACKUP_RESTORE_CENTER_ARCHITECTURE.md)  
**Backup Engine:** [`BACKUP_RESTORE_BACKUP_ENGINE.md`](./BACKUP_RESTORE_BACKUP_ENGINE.md)

No restore, scheduler, workers, queue consumers, automatic cleanup, or snapshot deletion.

---

## Verification lifecycle

States: `pending` → `running` → `verified` | `verification_failed` | `corrupted` → (`expired`)

Illegal transitions throw `IllegalVerificationTransitionError`. Each transition records timestamp, actor, reason.

---

## Verification pipeline

`VERIFICATION_PIPELINE_STAGES`:

1. load_snapshot  
2. load_manifest  
3. validate_metadata  
4. validate_storage_reference  
5. verify_checksum  
6. verify_compression_metadata  
7. verify_encryption_metadata  
8. validate_manifest  
9. update_verification_result  
10. complete_verification  

Engine: `VerificationEngine.verify(...)`.

---

## Integrity & manifest validation

`BackupManifestValidator` checks:

- schema version (`43c.1`)
- tenant ownership
- resource inventory / entity counts
- compression & encryption metadata alignment
- recovery point presence
- storage reference
- SHA-256 checksum of stored object vs snapshot metadata

---

## Retention engine

`RetentionEngine.evaluate(...)` supports:

| Mode | Behavior |
|------|----------|
| `forever` / `legal_hold` | Retain all; no expiry |
| `by_days` / `by_policy` | Expire by days (+ tenant override) |
| `by_count` | Keep newest N |

Also identifies orphaned snapshots (unknown backup job ids).  
Persists expiration **metadata** only — **never deletes**.

---

## Cleanup planning

Builds `CleanupPlanRecord` with expired / orphaned / policy_violation items, estimated reclaimed bytes, priority.  
`executed` is always `false` in 43d.

---

## Repository updates

Stores:

- `VerificationResultStore` — results + transition history  
- `RetentionEvaluationStore` — evaluations  
- `CleanupPlanStore` — plans  
- Snapshot store extensions: `updateVerificationStatus`, `markExpirationMetadata`

---

## Extension points

- Additional retention modes  
- Custom manifest schema versions  
- Future cleanup executor consuming plans (later phase)

---

## Forbidden (absent)

Restore · scheduler · workers · queue consumers · cleanup execution · snapshot deletion · UI
