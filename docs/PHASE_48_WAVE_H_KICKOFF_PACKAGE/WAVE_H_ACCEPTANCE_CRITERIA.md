# Wave H — Acceptance Criteria (Production-Acceptance style)

Kickoff checklist for **future** Wave H Production Acceptance.  
**This document does not accept Wave H.** No implementation in this package.

**SSOT:** `WAVE_H_FROZEN_SCOPE_EXTRACT.md` + Architecture Freeze / Frozen QA Plan / Enterprise QA Acceptance Architecture.

---

## 0. Entry gates (preconditions)

- [ ] Canonical base includes Wave G merge (`3b79c0f` or later accepted tip).
- [ ] Core APIs from prior waves present (catalog AR-02 models; scheduling booking; inventory/commission SoRs unchanged).
- [ ] Explicit CTO **implementation** authority granted for Wave H (kickoff alone is insufficient).
- [ ] Wave F / Wave G SoR remain closed (no reopen without new product failure).

---

## 1. AR-02 / identity invariants (must hold)

| Invariant | Required |
|-----------|----------|
| One clinical service identity | YES — no duplicate rows per language |
| AR + EN translations (as publish rules require) | YES |
| Aliases are search/marketing only | YES — never identity-bearing |
| Display-only overrides do not change `stableKey` | YES |
| Cross-tenant catalog isolation | DENY |

---

## 2. Behavioral acceptance

### P1-08 — Arabic catalog search + RTL booking

- [ ] Arabic query finds published services by Arabic `displayName` and **active aliases**.
- [ ] Search results resolve to the **same** canonical identity as English query for the same service.
- [ ] Reception can complete a booking path under Arabic locale + `dir=rtl` without layout/functional blockers that fail the Arabic/RTL pack.
- [ ] Snapshots / booking still freeze display text per AR-02 historical rule (no identity mutate via locale).

### P1-12 — Accessibility + tablet reception

- [ ] WCAG smoke (wcag2a/aa or freeze-specified tags) passes on reception-critical regions defined by the Accessibility/Tablet pack.
- [ ] Tablet viewport calendar interactions meet pack target-size / usability asserts.
- [ ] Functional a11y defects that **block booking or consent** are closed (Enterprise QA §11 ownership).
- [ ] Exit remains **functional gates** — Phase 50 polish dump is **not** required for Wave H PA.

### Owner inventory / commission UX (bounded)

- [ ] Owner can view inventory accountability / commission summary surfaces needed for reception/owner ops under the same i18n/RTL/a11y bar as packs require.
- [ ] No change to AR-20 / AR-21 / AR-22 accrual or ledger semantics.

---

## 3. Tenant / security

- [ ] Catalog search remains tenant-scoped / fail-closed for cross-tenant.
- [ ] Owner reports do not leak cross-tenant commission or inventory rows.
- [ ] No new permission stacks invented without seed + CTO note (prefer existing catalog/inventory/commission permissions).

---

## 4. Tests required (frozen pack intent)

| Pack | Minimum assert | Layers |
|------|----------------|--------|
| P1 Arabic/RTL Pack | Arabic catalog search + RTL booking | E2E + localization (+ API search proofs) |
| P1 Accessibility/Tablet Pack | WCAG smoke + tablet calendar targets | UI + a11y |

Also required for PA hygiene (implementation phase):

- [ ] Unit/API proofs for Arabic search + alias matching (H1).
- [ ] Playwright RTL booking + tablet calendar suites (H2/H3) — **not** disabled critical axe rules to “pass”.
- [ ] Release 47 / Clinic Dashboard / Platform DB / Super Admin gates remain green on accepting SHA (Wave I re-asserts globally; Wave H must not regress them).

---

## 5. Explicit non-goals (acceptance must NOT require)

- Phase 50 visual polish dump; full brand redesign.
- Wave I full onepass / all P0+P1 packs.
- Phase 49 / Step 30.
- Portal / POS / payroll.
- Reopening Wave F commission math or Wave G engagement SoR.
- Declaring PASS because `dir=rtl` on dashboard shell alone.

---

## 6. Exit sign-off block (for later CTO use)

```text
WAVE H PRODUCTION ACCEPTANCE = ________ (PENDING / ACCEPTED)
Evidence SHA = ________
P1-08 = ________
P1-12 = ________
Arabic/RTL Pack = ________
Accessibility/Tablet Pack = ________
Owner inventory/commission UX (bounded) = ________
Regressions (CD / Platform DB / Super Admin / Phase 28) = ________
Phase 50 polish dump = NOT REQUIRED
```

```text
self-granted Wave H PA = NO
```
