# C4 — Known limitations

- **C3 carry-forward:** schema-only Neon backup/restore drill = **PASS**; **full-data dump still FAIL/blocked** until rotated **owner** URL is used out-of-band for dump (FORCE RLS + migrate-admin NOBYPASSRLS).
- **Offsite / PITR** = **EXTERNAL** — not claimed by C3 or C4.
- **D-17 deploy topology / CD / k8s** = **EXTERNAL** — not invented in-repo; app deploy/rollback not executed.
- **Neon branch label `production` ≠ product production cutover.**
- **Neon primary wipe** = not done (correct).
- **Health endpoints** not exercised against a live pilot API on this host.
- Observability readiness PASS is **unit/spec packaging** (K4 reuse), not a claim that pilot APM/paging is live.
- Local `apps/api/.env` on the agent host is **not** claimed to be the Neon pilot secrets vault.
- Phase 49 K5 historical dry-run was doc-walkthrough **PARTIAL**; C4 adds **execution evidence** where possible without fake cutover.
