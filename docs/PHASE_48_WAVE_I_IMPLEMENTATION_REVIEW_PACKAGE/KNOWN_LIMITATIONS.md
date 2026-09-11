# Wave I Known Limitations

- **Wave I PA** remains **PENDING EXTERNAL** — this package does not grant acceptance.
- **AppointmentForm clinical-catalog picker** identity binding stays deferred (Wave H/I OUT).
- **Shared Wave E suites** across course/device/derm packs — intentional; no invented Dermatology EMR pack.
- **Combined Traceability** still lives inside `wave-f-round4` under `R4-TRACE` name pattern (first-class npm identity; not a new product suite).
- **Wave H migration validators** ABSENT — Wave H introduced no Prisma/SQL migrations.
- **Permission-routes validators** not folded into migration packs (unchanged policy).
- **Optional** `phase48-pack-matrix.yml` is `workflow_dispatch` only — not branch protection.
- **E2E** requires live API + Playwright webServers; skip-if-API-down is **FAIL** for Wave I evidence.
- Local `.ci-evidence/**` is uncommitted by policy.
