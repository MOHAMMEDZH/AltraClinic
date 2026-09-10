# Wave H Change Summary

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-h-ux-localization` |
| Tip SHA | `c64a435` |
| Commits | `52ef5ad` (H0), `c2565fd` (H1), `37007d4` (H2), `76576c0` (H3), `c64a435` (H4) |
| Base | Wave G merge `3b79c0f` |

## Search API (H1)

- `buildClinicalCatalogSearchOr` — `stableKey` + `translations.displayName` + **ACTIVE** `aliases.aliasText`
- Wired into `ClinicalCatalogService` list/search where-clause
- No schema migration; AR-02 identity unchanged

## RTL / booking UI (H2)

- Clinical catalog UI debounced `search=` to API
- `AppointmentForm` `dir` from locale + `data-testid="appointment-form"`
- Playwright Arabic/RTL booking smoke

## Accessibility + tablet (H3)

- Reception chrome + calendar controls + appointment-form axe (**no** critical `disableRules`)
- Tablet 1024×768 touch-target / form open asserts
- Scheduling i18n for calendar view aria-label; tablet CSS stack/targets

## Owner read UX (H4)

- `/inventory/reports` — Wave C `GET /inventory/usage/owner-report` panel (fail-closed `api.inventory` **export**; PHI off)
- `/billing/commissions` — provider list enhancements + Wave F `GET /workforce-commercials/owner-report` summary (fail-closed `api.staff-commission` **export**)
- No accrual/settlement/ledger SoR edits

## What did not change

- Wave F / Wave G SoRs
- Prisma commission/inventory accountability engines
- AppointmentForm clinical-catalog identity binding
- Portal / POS / payroll
- Phase 50 redesign
