# Wave I — Pack Matrix

**Purpose:** Authoritative frozen-pack → runnable command inventory.
**Evidence base:** I0 `2f06970` → I1 `cf6617a` → I2/I3 `070f1c3` → I4 `5922b20` → I5 (this tip).
**Machine SSOT:** `apps/api/scripts/phase48-pack-matrix.json`
**Runner:** `node apps/api/scripts/run-phase48-pack.mjs <pack-id>` (also via npm scripts below).
**Onepass (I5):** `npm run test:phase48-onepass` (API packs); `npm run test:phase48-onepass:with-e2e` when API+webServer up.

Do **not** treat script presence as Wave I Production Acceptance.

---

## How to run

```bash
cd apps/api
npm run test:phase48-pack-list
npm run test:phase48-p0-catalog
npm run test:phase48-onepass              # P0+P1 API + trace + mig A–G
npm run test:phase48-regression-baselines # Step 28 then Step 29

cd ../clinic-dashboard
npm run test:phase48-p1-arabic-rtl-e2e    # requires API/webServer; skip≠PASS
npm run test:phase48-p1-accessibility-tablet
npm run test:phase48-owner-ux
```

Jest always uses `--runInBand`. `requiresDb` with 0 passed = **FAIL**. Playwright API-down skip = **FAIL**.

---

## Optional CI (workflow_dispatch only)

| Workflow | File | Trigger |
|----------|------|---------|
| Phase 48 Pack Matrix (manual) | `.github/workflows/phase48-pack-matrix.yml` | **`workflow_dispatch` only** |

**Not** a required PR check / branch-protection gate.

---

## API packs (`apps/api`)

| Frozen pack | npm script | Notes |
|-------------|------------|-------|
| P0 Catalog Integrity Pack | `test:phase48-p0-catalog` | I2 green |
| P0 Pricing / Snapshot Pack | `test:phase48-p0-snapshot-pricing` | I2 green |
| P0 Scheduling Concurrency Pack | `test:phase48-p0-concurrency` | I2 green |
| P0 Provider Eligibility Pack | `test:phase48-p0-eligibility` | I2 green |
| P0 Consent Pack | `test:phase48-p0-consent` | I2 green |
| P0 Injectable Traceability Pack | `test:phase48-p0-injectable` | I2 green |
| P0 Treatment Plan Link Pack | `test:phase48-p0-plan-link` | I2 green |
| P0-10 Inventory Accountability Pack | `test:phase48-p0-inventory-accountability` | I2 green |
| P1 Operatory / Course / Device / Derm / Lab / Pre-Post / Waitlist / Availability / Recall / Commission / Arabic-RTL | `test:phase48-p1-*` | I3 green |
| Combined Traceability Pack | `test:phase48-combined-traceability` | I4; R4-TRACE via name pattern |
| Migration Clean | `test:phase48-migration-clean` | **A–G** clean; **Wave G wired**; **Wave H ABSENT** |
| Migration Upgrade | `test:phase48-migration-upgrade` | **A–G** upgrade; **Wave G wired**; **Wave H ABSENT** |
| Regression baselines | `test:phase48-regression-baselines` | Step 28 then Step 29 |
| Phase 48 onepass | `test:phase48-onepass` | I5 thin orchestrator over I1 runner |

### Migration G/H decision (I4)

| Wave | Prisma/SQL migrations? | Validators |
|------|------------------------|------------|
| **G** | YES (G1–G3) | **WIRED** `validate-phase48-wave-g-{clean,upgrade}.mjs` |
| **H** | NO (UX only) | **ABSENT** (not a fake PASS) |

---

## Clinic-dashboard packs

| Surface | npm script | Notes |
|---------|------------|-------|
| P1 Arabic/RTL (booking e2e) | `test:phase48-p1-arabic-rtl-e2e` | I3 green with live API |
| P1 Accessibility/Tablet | `test:phase48-p1-accessibility-tablet` | I3 green |
| Owner UX (H4 bounded) | `test:phase48-owner-ux` | I3 green |

Also invokable via `npm run test:phase48-onepass:with-e2e` from `apps/api`.

---

## Explicit non-goals

- Required GitHub Checks / branch protection
- Second test framework
- Wave A–H SoR reopen
- Self-granted Wave I Production Acceptance
- Phase 49 / 50 / 51
