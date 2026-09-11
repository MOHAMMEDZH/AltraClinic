# Wave H Known Limitations

CTO-accepted / intentionally deferred (not blockers for H5 pack packaging):

| Item | Status |
|------|--------|
| `AppointmentForm` still uses **serviceType enum**, not clinical-catalog identity picker | Deferred known limitation (H2 commit note); not H5 |
| H3 axe scoped to reception chrome + calendar controls + appointment-form — **not** full `#scheduling-region` (legacy precursor still disables color-contrast on full hub) | By design H3 |
| Playwright skip-if-API-down locally | Same helper as H2–H4; PR CI is authoritative e2e gate |
| Owner accountability / staff-commission panels nested on existing routes (no dedicated new routes) | Minimal H4; optional promote later |
| Owner panels show truncated UUIDs for user/item ids (no display-name join) | Read-slice minimal |
| PHI never requested from inventory owner-report UI (`includePhi` off) | Fail-closed / privacy |
| Catalog deepLink `/reports/commission-summary` vs billing list `route` confusion | Pre-existing hub quirk; not redesigned |
| CD / Platform DB / Super Admin / Phase 28 full gates | Require PR CI — not claimed locally |
| Wave I onepass / Phase 49 / Phase 50 polish | Explicit OUT |
