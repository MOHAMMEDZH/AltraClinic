# L1 — Legal / commercial boundaries inventory

**Lineage:** `9a2e89d+` · **Owners:** CTO / Ops / Legal (docs only)  
**Phase 51 claim:** none (inventory only)

---

## Surfaces found (ops / topology EXTERNAL)

| Item | Paths | Status |
|------|-------|--------|
| D-17 deploy topology external | `docs/RELEASE_47_STEP29_RELEASE_READINESS.md`; K5 `01_DEPLOY_RUNBOOK.md` | **PASS-local** |
| K5 explicit OUT (no in-repo k8s/CI→CD) | `docs/PHASE_49_K5_DEPLOY_ROLLBACK/04_EXPLICIT_OUT.md` | **PASS-local** |
| K3 backup external boundaries | `docs/PHASE_49_K3_BACKUP_RESTORE/03_EXTERNAL_BOUNDARIES.md` | **PASS-local** |
| K4 observability EXTERNAL (APM/SIEM/pager) | `docs/PHASE_49_K4_OBSERVABILITY_ALERTING/04_EXPLICIT_OUT.md` | **PASS-local** |
| K7 pager / ITS M EXTERNAL | `docs/PHASE_49_K7_INCIDENT_BASICS/00_README.md` | **PASS-local** |
| OPERATOR_INDEX EXTERNAL callouts | `docs/OPERATOR_INDEX.md` | **PASS-local** |
| Licensing — Stripe sync “future” | `docs/LICENSING_ARCHITECTURE.md` | **PARTIAL** |
| Catalog discovery — external billing partial | `docs/SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md` | **PARTIAL** |
| Terms of service / privacy policy docs in `docs/` | — | **MISSING** |
| Unified Phase 51 in-product vs external register | `docs/PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/` | **PASS-local** (docs register; ToS/privacy still MISSING) |

---

## Gaps (for L5) — addressed by L5 package

1. Unified in-product vs external register → **`PHASE_51_L5_LEGAL_COMMERCIAL_BOUNDARIES/`**.  
2. Payment collection path remains PARTIAL — register + L2 honesty.  
3. ToS/privacy remain **MISSING** in-repo — honest row; not invented.

## Explicit OUT for L1

No inventing external vendors. No product SoR changes. No claiming legal complete.
