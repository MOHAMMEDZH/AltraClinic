# Phase 49 — Known Limitations

- **Phase 49 PA** = **ACCEPTED** by CTO @ evidence tip `5bfda08` / merge `1501190` (not self-granted).
- Topology (D-17) remains external — no in-repo prod k8s/Docker deploy platform.
- Paging / APM / SIEM / on-call SaaS remain EXTERNAL interfaces (K4/K7).
- **K3** full-data restore of local `booking_test` fails on orphan FK (`commission_package_session_allocations`) — fixture debt; schema-only drill PASS.
- **K5** dry-run was **PARTIAL** — no production cutover executed in Phase 49 packaging.
- **Platform DB CI** path filter may skip PRs — force-run or local K6 evidence at accept SHA.
- Local **`.ci-evidence/**`** and backup dumps remain **uncommitted** by policy.
- Day-2 hub: `docs/OPERATOR_INDEX.md`.
