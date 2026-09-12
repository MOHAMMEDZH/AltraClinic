# Wave I Regression Results

| Field | Value |
|-------|--------|
| Command | `npm run test:phase48-regression-baselines` |
| Layers | Step 28 security final onepass → Step 29 release final onepass |
| Evidence | `apps/api/.ci-evidence/wave-i5-onepass-<I5-shortsha>/regression-baselines.txt` (uncommitted) |
| Result | **PASS** (exit 0) |

| Gate | Result |
|------|--------|
| Step 28 security final onepass | **PASS** |
| Step 29 release final onepass | **PASS** |

**Not** added as required GitHub Checks. Local green is evidence for external PA only.

## Local notes (I5)

- Exclusive Postgres/Redis; live API on `:3000` must be down (steals delivery jobs).
- Restored `api.observability` to permission matrix (removed in Wave A rewrite).
- Dep overrides for Step 28 dep-audit/classify; TENSA fixture matrix-aligned.
