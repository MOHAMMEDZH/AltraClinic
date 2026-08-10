# Release 43.0 — Backup & Restore Center

**Version:** `v43.0.0` (candidate)  
**Codename:** Backup & Restore Center  
**Acceptance date:** 2026-07-18  
**Status:** **READY FOR RELEASE 43.0** (feature flag **disabled by default**)

---

## Freeze baselines

| Scope | Status |
|-------|--------|
| Release 42.0 Import/Export | **FROZEN** (`docs/RELEASE_42.0.md`) |
| Phase 43 Architecture SSOT | **APPROVED** |
| Phase 43a–43f implementation | **COMPLETE** — no further feature work in 43g |
| Phase 43g | Production Acceptance only |

Master flag: `BACKUP_RESTORE_CENTER_ENABLED=false` by default.

---

## What shipped (43a–43f)

| Phase | Capability |
|-------|------------|
| 43a | Foundation — module, flags, RBAC, licensing, health, contracts |
| 43b | Job Engine — lifecycle, progress, cancel, retry metadata |
| 43c | Backup Engine — pipeline, snapshot, compress, encrypt, storage port |
| 43d | Verification & Retention — verify + cleanup **planning** |
| 43e | Restore Engine — verified-only restore / drill |
| 43f | Operations UI + thin API façade |
| 43g | Production Acceptance |

Evidence: [`BACKUP_RESTORE_PRODUCTION_ACCEPTANCE.md`](./BACKUP_RESTORE_PRODUCTION_ACCEPTANCE.md)

---

## Explicit non-goals (still out of scope)

Scheduler · workers · queue consumers · cleanup execution · snapshot deletion · live cloud storage providers · UI algorithms

---

## Related docs

- Architecture SSOT  
- Foundation / Job / Backup / Verification-Retention / Restore / Operations UI docs  

---

**Document control:** READY FOR RELEASE 43.0 · 2026-07-18 · default flag OFF
