# K1 — Tenant Isolation Inventory

**Lineage:** `9eac595+` · **Owner (incident):** Platform Security / Identity (`docs/SECURITY_RUNBOOKS.md` §3)  
**Phase 49 claim:** none (inventory only)

---

## Surfaces found

| Item | Paths / evidence | Status |
|------|------------------|--------|
| Platform DB Security CI | `.github/workflows/platform-db-security-ci.yml`; npm `test:platform-db-security` → `scripts/run-platform-db-security.mjs` | **PASS-local** |
| RLS apply | `apps/api/scripts/apply-rls.mjs`; `npm run db:rls:apply` | **PASS-local** |
| Upgrade migrate validators | `db:test:migrate`, `db:test:upgrade-validate` | **PASS-local** |
| Wave I pack matrix (tenant-scoped packs) | `test:phase48-p0-*`, `test:phase48-p1-*`, `test:phase48-combined-traceability`, `test:phase48-onepass`; `docs/PHASE_48_WAVE_I_*`; workflow `phase48-pack-matrix.yml` | **PASS-local** (QA closed; reuse, don’t reopen SoR) |
| Cross-tenant / RLS specs (examples) | Numerous `*.cross-tenant*.spec.ts`, `*rls*.spec.ts` under `apps/api/src/modules/**/tests` | **PASS-local** |
| Security runbook — cross-tenant | `docs/SECURITY_RUNBOOKS.md` §3 | **PASS-local** |
| Super Admin CI | `.github/workflows/super-admin-ci.yml` | **PASS-local** (platform boundary precursor) |
| Phase 49 “production-check packaging” (named hardening gate) | — | **MISSING** |
| Re-open Wave A–I SoR for isolation | Explicitly OUT | N/A |

---

## Reuse recommendation (K6 input)

```text
Prefer: test:platform-db-security
Prefer: selected phase48 packs that assert tenant isolation (inventory only — do not redesign packs)
Prefer: SECURITY_RUNBOOKS §3 as incident procedure
Do NOT: invent second isolation framework
Do NOT: reopen Wave SoR
```

---

## Gaps (for K6)

1. Strong product/QA isolation evidence lacks a thin **Phase 49 production-check** wrapper/docs (which commands to run at hardening accept SHA).
2. Platform DB Security workflow is path-filtered — may not run on every PR; packaging must state when to force-run.
3. Distinguish clinic RLS vs platform admin boundary in the Phase 49 checklist.
