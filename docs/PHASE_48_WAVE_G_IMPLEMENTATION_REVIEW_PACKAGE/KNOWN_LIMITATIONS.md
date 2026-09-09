# Wave G Known Limitations

CTO-accepted / intentionally deferred (not blockers for G5 pack green):

| Item | Status |
|------|--------|
| Authz uses `api.scheduling` (view/create/update/manage), **not** a dedicated `api.outreach` stack | Documented; conceptual `outreach.admin` / `schedule.admin` mapped here |
| Due-scan UI always calls with `notify=false` | Policy; notify remains API-capable |
| No scheduled background worker for due-scan or offer TTL expiry | API / job-hook only (`expire-due`, `due-scan` endpoints) |
| Availability exception list UI is unfiltered (no from/to/branch filters required for packs) | OK per CTO |
| `waitlist.auto_book` default **OFF**; no clinic UI toggle | Required; silent auto-book forbidden |
| Offer accept/reject gated on `api.scheduling` **create** | CTO policy |
| Bounded `eligibilityExpr` only (`minAgeYears`, `requireLastService`) — no full DSL | By design G3 |
| Due-scan qualifying appointments = **COMPLETED** only | CTO-required G3 fix |
| Legacy waitlist “contact reception” notifier kept registered, unused by cancel→offer path | KEEP |
| Wave H a11y/RTL / Wave I onepass / Phase 49 | Explicit OUT |
| CD / Platform DB / Super Admin / Phase 28 full gates | Require PR CI — not claimed locally |
