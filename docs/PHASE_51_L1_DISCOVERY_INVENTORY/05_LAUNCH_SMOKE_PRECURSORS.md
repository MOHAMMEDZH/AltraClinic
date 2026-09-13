# L1 — Launch smoke / go-live evidence precursors

**Lineage:** `9a2e89d+` · **Owners:** QA / Release  
**Phase 51 claim:** none (inventory only)  
**Rule:** reuse existing packs — **no second test framework**

---

## Surfaces found

| Item | Paths | Status |
|------|-------|--------|
| Wave I pack matrix | `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_PACK_MATRIX.md` | **PASS-local** |
| Pack matrix JSON + runners | `apps/api/scripts/phase48-pack-matrix.json`, `run-phase48-pack.mjs`, `run-phase48-onepass.mjs` | **PASS-local** |
| Wave I npm scripts | `apps/api/package.json` → `test:phase48-*`, `test:phase48-onepass` | **PASS-local** |
| Step 28 / 29 final onepass | `run-step28-final-onepass.mjs`, `run-step29-final-onepass.mjs` + npm scripts | **PASS-local** |
| Clinic Progressive Inventory A–E | `.github/workflows/clinic-dashboard-ci.yml` → `progressive-inventory` | **PASS-local** |
| Clinic Inventory E2E | same workflow → `inventory-e2e` | **PASS-local** |
| Phase 48 pack matrix workflow | `.github/workflows/phase48-pack-matrix.yml` (manual dispatch) | **PARTIAL** |
| Phase 49 observability wrapper | `test:phase49-observability-readiness` | **PASS-local** |
| Phase 49 tenant isolation wrapper | `test:phase49-tenant-isolation-check` | **PASS-local** |
| Phase 49 K3 restore drill helper | `apps/api/scripts/phase49-k3-restore-drill.ps1` | **PARTIAL** |
| Phase 51 launch smoke evidence format | — | **MISSING** |

---

## Gaps (for L6)

1. Baselines exist; **Phase 51 go-live evidence format** (what to capture, where to cite) is MISSING.  
2. Do not invent a new GH Checks brand — map launch smoke onto existing Wave I / Step 28–29 / Progressive / Inventory.  
3. Manual pack-matrix workflow remains optional — not a required PR gate invention.

## Explicit OUT for L1

No second a11y/test framework. No required GH Checks changes. No fake “all green = commercially launched.”
