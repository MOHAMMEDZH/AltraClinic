# Wave I Change Summary

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-i-enterprise-qa` |
| Commits | I0 `2f06970`, I1 `cf6617a`, I2/I3 `070f1c3`, I4 `5922b20`, I5 _(tip)_ |
| Base | `d53ff77` (Wave H merge) |

## I0 — Kickoff

- `docs/PHASE_48_WAVE_I_KICKOFF_PACKAGE/*` frozen scope, slices, acceptance criteria

## I1 — Pack matrix + runners

- `phase48-pack-matrix.json` + `run-phase48-pack.mjs`
- `test:phase48-*` npm scripts (API + clinic-dashboard e2e aliases)
- Optional `.github/workflows/phase48-pack-matrix.yml` (`workflow_dispatch` only)

## I2 — P0 green

- Windows-safe Jest spawn (`node jest.js`); `requiresDb` fails if 0 passed
- All 8 P0 packs green on `070f1c3`

## I3 — P1 green (evidence-only)

- All 11 API P1 packs + 3 dashboard e2e packs green on `070f1c3`
- No empty commit (already green)

## I4 — Traceability + migrations

- Combined Traceability: R4-TRACE name pattern; Jest summary parse with skips
- Wave G clean/upgrade validators + matrix wiring
- Upgrade A–F later-wave park helper (`phase48-park-later-migrations.mjs`)
- Wave H validators ABSENT (documented)

## I5 — Onepass + regression + review

- `run-phase48-onepass.mjs` + `test:phase48-onepass` / `:with-e2e`
- Regression baselines (Step 28 then 29)
- This review package; pack matrix sync (G wired / H ABSENT)
- Step 28 dep-gate bumps (multer/nodemailer/js-yaml/browserslist/postcss/sharp overrides)
- TENSA01 fixture: permission resource `api.patients` / action `view` (matrix-aligned)
- Playwright `buildApiWebServerEnv` / `resolveApiWebServerRedisUrl`: honor inherited env only (vitest isolation)
- Restore `api.observability` to permission matrix (dropped in Wave A rewrite; required for Step 29)

## What did not change

- Wave A–H product SoRs
- Clinical catalog AppointmentForm picker binding
- Required branch-protection / GitHub Checks
- Second test framework
