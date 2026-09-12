# Wave I Changed Files Manifest

Range: `d53ff77..I5-tip` (Wave I branch only). Paths below include I0–I5; I5 adds onepass + review package.

## Docs

- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/README.md`
- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_ACCEPTANCE_CRITERIA.md`
- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_CURRENT_STATE_VS_EXIT.md`
- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_FROZEN_SCOPE_EXTRACT.md`
- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_IMPLEMENTATION_SLICES.md`
- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/WAVE_I_PACK_MATRIX.md`
- `docs/PHASE_48_WAVE_I_IMPLEMENTATION_REVIEW_PACKAGE/*` (I5)

## API harness

- `apps/api/package.json` (`test:phase48-*`, `test:phase48-onepass`, dep bumps)
- `apps/api/scripts/phase48-pack-matrix.json`
- `apps/api/scripts/run-phase48-pack.mjs`
- `apps/api/scripts/run-phase48-onepass.mjs` (I5)
- `apps/api/scripts/phase48-park-later-migrations.mjs` (I4)
- `apps/api/scripts/validate-phase48-wave-g-clean.mjs` (I4)
- `apps/api/scripts/validate-phase48-wave-g-upgrade.mjs` (I4)
- `apps/api/scripts/validate-phase48-wave-{a,b,c,d,e,f}-upgrade.mjs` (I4 later-park)
- `apps/api/src/modules/security-hardening/tests/step28-tensa-clinic-super-admin.unit.spec.ts` (I5 TENSA fixture)

## Root / workspaces (I5 dep gates)

- `package.json` overrides (multer, nodemailer, js-yaml, browserslist, postcss)
- `package-lock.json`
- `apps/clinic-dashboard/package.json` (postcss; I1 e2e scripts)
- `apps/clinic-dashboard/playwright.config.ts` (I5 Redis env isolation for vitest)
- `apps/super-admin/package.json` (postcss)
- `apps/api/config/permission-matrix.json` / `packages/permissions/permission-matrix.json` / `docs/permission-matrix.json` (restore `api.observability`)
- `apps/api/config/permission-matrix.json` / `packages/permissions/permission-matrix.json` / `docs/permission-matrix.json` (restore `api.observability`)

## CI (optional)

- `.github/workflows/phase48-pack-matrix.yml` — `workflow_dispatch` only

## Explicitly not in Wave I commits

- Product SoR under Waves A–H
- `apps/api/.ci-evidence/**` (uncommitted)
- Leftover `vite.config.js` dirt (not required)
