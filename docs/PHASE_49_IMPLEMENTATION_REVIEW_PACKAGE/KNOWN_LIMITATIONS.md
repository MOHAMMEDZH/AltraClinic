# Phase 49 — Known Limitations

- **Phase 49 PA** remains **PENDING EXTERNAL** — this package does **not** grant acceptance.
- **Topology (D-17)** is external — no in-repo prod k8s/Docker deploy platform.
- **Paging / APM / SIEM / on-call SaaS** are EXTERNAL interfaces (K4/K7) — not wired as required in-repo products.
- **K3** full-data restore of local `booking_test` fails on orphan FK (`commission_package_session_allocations`) — fixture debt; schema-only drill PASS; not fixed in Phase 49.
- **K5** dry-run is **PARTIAL** — no production cutover was executed or claimed.
- **Platform DB CI** path filter may skip PRs — force-run or local K6 evidence required at accept SHA.
- **Wave I / Step 28/29** full onepass not re-required for every K slice (optional/heavy).
- Local **`.ci-evidence/**`** and backup dumps remain **uncommitted** by policy.
- **Phase 50 / Phase 51** not started.
