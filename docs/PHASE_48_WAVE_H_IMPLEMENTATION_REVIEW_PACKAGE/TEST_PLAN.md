# Wave H Test Plan

| Pack | Frozen name | Specs / commands | Assert focus |
|------|-------------|------------------|--------------|
| Arabic search | P1 Arabic/RTL Pack (search half / H1) | `wave-h1-arabic-catalog-search.unit.spec.ts`, `.postgres.integration.spec.ts` | displayName + active alias; same canonical id; inactive alias deny; cross-tenant deny |
| RTL booking | P1 Arabic/RTL Pack (booking half / H2) | `e2e/wave-h2-arabic-rtl-booking.spec.ts` | ar-SY + `dir=rtl`; open book form; catalog API search |
| A11y + tablet | P1 Accessibility/Tablet Pack (H3) | `e2e/wave-h3-a11y-tablet.spec.ts` | axe on reception chrome + form **without** critical disableRules; tablet 1024 targets |
| Owner UX | Bounded owner inventory/commission (H4) | `e2e/wave-h4-owner-ux.spec.ts` | RTL owner commissions + inventory accountability regions; optional axe |
| Clinic smoke | H2–H4 hygiene | `npx tsc -b`; vitest clinical-catalog / scheduling-config / billing+inventory config / i18n | Types + unit gates |

## Layers

- **Unit (API):** search OR builder (Jest)
- **Postgres:** catalog search identity + tenant isolation
- **UI:** TypeScript build + focused vitest
- **E2E:** Playwright packs (skip-if-API-down locally; full gate on PR CI)

## Not in H5 local plan

- GitHub CD / Platform DB / Super Admin / Phase 28 full CI (require PR)
- Wave I onepass
- Production Acceptance sign-off
