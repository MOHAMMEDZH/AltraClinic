# Phase 49 K3 — Backup / Restore Posture

| Field | Value |
|-------|--------|
| **Slice** | K3 — Backup/restore posture |
| **Status** | Docs + thin restore drill; **Phase 49 PA = PENDING** |
| **Branch** | `cursor/phase49-production-hardening-kickoff` |
| **Base lineage** | `9eac595` |
| **K2 tip** | `521bdaf` |
| **Authority** | CTO authorize K3 only; K4–K7 **NOT** started |

## Files

| File | Purpose |
|------|---------|
| [01_SOR_BOUNDARY.md](./01_SOR_BOUNDARY.md) | Cutover SoR vs Backup Center precursor |
| [02_RESTORE_DRILL_PROCEDURE.md](./02_RESTORE_DRILL_PROCEDURE.md) | Thin backup → verify → restore → smoke |
| [03_EXTERNAL_BOUNDARIES.md](./03_EXTERNAL_BOUNDARIES.md) | Offsite / PITR / RTO-RPO OUT |
| [04_EVIDENCE_FORMAT.md](./04_EVIDENCE_FORMAT.md) | Drill log layout (uncommitted) |
| [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md) | Non-goals |

## Scripts (reuse)

```text
apps/api/scripts/backup-postgres.sh | .ps1   — cutover backup (native pg_dump)
apps/api/scripts/verify-backup.sh            — checksum + gzip -t
apps/api/scripts/restore-postgres.sh         — restore into target DATABASE_URL
apps/api/scripts/phase49-k3-restore-drill.ps1 — Windows/Docker disposable drill helper (not a new engine)
```

```text
Phase 49 PA = PENDING
Backup Center flag-OFF product ≠ Phase 49 cutover SoR
K4–K7 = NOT AUTHORIZED
```
