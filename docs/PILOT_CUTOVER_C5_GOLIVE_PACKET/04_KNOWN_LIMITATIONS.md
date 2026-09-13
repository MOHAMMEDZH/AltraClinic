# C5 — Known limitations

- **Packaging PA** = **ACCEPTED** by CTO @ `b2e1b40` (not self-granted).
- **Real tenant pilot** = **NOT AUTHORIZED** until STOP S1–S4 clear.
- **STOP S1–S4** remain **OPEN** (not PASS).
- **C2b** Neon migrate/RLS/isolation = **PASS**; does not equal product production cutover.
- **C3** = **PARTIAL** — schema restore PASS; full-data dump still blocked without owner dump role; offsite/PITR **EXTERNAL**.
- **C4** = **PARTIAL** — dry-run execution evidence; health/CD SKIP; no fake cutover.
- Neon branch label **`production` ≠ product production**.
- D-17 topology / CD / k8s / paging SaaS remain **EXTERNAL**.
- Payment / Stripe live = **not claimed** (Phase 51 honesty).
- D5 AppointmentForm catalog picker remains **DEFERRED**.
- Uncommitted `.ci-evidence/pilot-c*` paths are citable; not committed by policy.
- This packet does **not** clear STOP-the-line items (S1–S4).
