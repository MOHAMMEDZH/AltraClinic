# L6 — Recommended launch smoke map (reuse only)

Working directory: `apps/api` unless noted.

---

## Thin map (authorized for L6 local run)

| # | Command | Needs | Notes |
|---|---------|-------|-------|
| 1 | `npm run test:phase49-observability-readiness` | Node + Jest | Existing K4 wrapper — no new suite |
| 2 | `npm run test:phase49-tenant-isolation-check` | Test Postgres `:5433` (or env URLs) | Existing K6 wrapper — **fail closed** if DB unreachable |
| — | `npm run test:phase51-launch-smoke` | Same as 1→2 | Optional alias wrapping the two scripts above |

---

## Complementary (do not invent new brands)

| Surface | Role |
|---------|------|
| Clinic CI `progressive-inventory` + `inventory-e2e` | Path-filtered PR gates on accepting lineage |
| Wave I pack matrix / `test:phase48-*` | Optional thin pack when time/DB allow — see L1 `05_LAUNCH_SMOKE_PRECURSORS.md` |
| `test:phase48-onepass` | **Optional / heavy** — not required for L6 |
| `test:step28-security-final-onepass` / `test:step29-release-final-onepass` | **Optional** — release-gate context; not mandatory for L6 |

---

## Suggested local sequence

```powershell
cd apps/api
$sha = git rev-parse --short HEAD
$dir = ".ci-evidence/phase51-l6-$sha"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

npm run test:phase49-observability-readiness 2>&1 | Tee-Object "$dir/01_observability.txt"
npm run test:phase49-tenant-isolation-check 2>&1 | Tee-Object "$dir/02_tenant_isolation.txt"
# Then write 00_SUMMARY.md with PASS/FAIL/SKIP
```

Or: `npm run test:phase51-launch-smoke` (alias) then capture outputs into the same folder.
