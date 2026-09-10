# Wave H — Current State vs Exit Criteria

**Purpose:** Prove that existing i18n / RTL / axe / tablet precursors are **PARTIAL**, not Wave H completion.  
**Base:** `3b79c0f` (Wave G merge on `release47-step22-transfer-20260810-0353`).  
**Kickoff only — no Production Acceptance claim.**

---

## Wave H exit criteria (frozen)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` Wave H **Exit**:

```text
Functional a11y gates (not Phase 50 polish dump)
```

Mapped to P1 / AR:

| Exit element | Frozen ID | Required behavior |
|--------------|-----------|-------------------|
| Arabic catalog search | P1-08 / AR-02 | Search finds canonical services via AR translations/aliases; one identity |
| RTL booking quality | P1-08 | Reception booking path works under RTL + Arabic locale (E2E pack) |
| Functional a11y + tablet | P1-12 | WCAG smoke + tablet calendar targets; block booking/consent defects |
| Owner inventory/commission UX | Wave H domain | Operable owner read UX (no SoR rewrite) |

Frozen packs:

```text
P1 Arabic/RTL Pack = FROZEN
P1 Accessibility/Tablet Pack = FROZEN
```

---

## What exists today (repo evidence @ `3b79c0f`)

### A. AR-02 SoR models (Wave A) — PARTIAL for P1-08

`apps/api/prisma/schema.prisma`:

- `ClinicalServiceTranslation` — locale + `displayName` (+ descriptions); unique `(clinicalServiceId, locale)`  
- `ClinicalServiceAlias` — locale + `aliasText`; indexed for search; **never identity-bearing**  
- Display-only tenant override models exist alongside (AR-02 display override)

**Present:** One identity + AR/EN translation/alias storage.  
**Absent vs Wave H exit:** Dedicated Arabic/RTL **acceptance pack** proving search + booking UX quality end-to-end.

### B. Catalog list search — PARTIAL

`ClinicalCatalogService.listServices` `buildListWhere`:

- `search` matches `stableKey` OR `translations.displayName` (contains, insensitive)  
- Does **not** clearly assert alias-text search in the same path (aliases indexed but search-path completeness is a H1 gap to close/prove)

**Verdict:** Data model + some displayName search ≠ frozen “Arabic catalog search” pack green.

### C. Clinic dashboard i18n / locale

- Large message catalogs (`scheduling-messages`, settings localization nav, etc.)  
- Locale switch / `dir` via white-label / i18n helpers  
- Settings surface: localization keywords include arabic/rtl  

**Present:** EN/AR string infrastructure.  
**Absent:** Pack proving Arabic **catalog** query → bookable service selection under RTL.

### D. Existing RTL e2e — PARTIAL precursors ≠ H exit

Examples (clinic-dashboard):

| Spec | What it proves | Why ≠ H exit |
|------|----------------|--------------|
| `e2e/dynamic-search.spec.ts` — Arabic RTL search dialog | `dir=rtl` on dynamic search UI | Not clinical catalog Arabic search / booking |
| `e2e/dynamic-navigation.spec.ts` — Arabic RTL sidebar | Navigation under `ar-SY` | Not booking flow |
| `e2e/dynamic-dashboard.spec.ts` — Arabic RTL | Dashboard shell `dir` | Not P1-08 booking |
| `e2e/dynamic-white-label.spec.ts` | direction ltr/rtl | Branding, not catalog |

**No** dedicated `P1 Arabic/RTL Pack` suite asserting catalog Arabic search + RTL appointment booking quality.

### E. Existing a11y e2e — PARTIAL precursors ≠ H exit

Many axe smokes exist (`scheduling-a11y`, `ai-a11y`, `patients-a11y`, …). Wave G fixed locked AI card contrast for CI.

**Present:** Opportunistic WCAG smokes on various modules.  
**Absent vs P1-12:**

- Formal **Accessibility/Tablet Pack** with tablet calendar touch-target asserts  
- Explicit gate that functional a11y defects **blocking booking/consent** are closed (Enterprise QA §11)  
- Explicit **not** Phase 50 polish scope boundary in pack definition  

Mobile AI axe still disables `color-contrast` in one case — precedent for scoped rules, not H exit.

### F. Owner inventory / commission UX

- Inventory ops + commission API clients exist from Waves C/F  
- Architecture Addendum places **owner inventory/commission UX** in Wave H  

**Present:** Backend SoRs + some dashboard ops.  
**Absent:** Wave H–scoped owner UX polish/localization/a11y closure as a deliberate H slice (must not mutate F/C SoR).

---

## Gap matrix (current → exit)

| Frozen requirement | Current | Gap |
|--------------------|---------|-----|
| Arabic catalog search (displayName + aliases) | Partial displayName contains; aliases under-proven | **H1 IMPROVE + prove** |
| No language-row duplicates | AR-02 models prevent | Keep invariant in H1 tests |
| RTL booking quality E2E | Shell RTL samples only | **H2 IMPLEMENT pack** |
| Localization for reception-critical paths | Many strings; uneven coverage | **H2/H3 fill gaps as pack requires** |
| WCAG functional smoke (booking/consent) | Scattered axe specs | **H3 packize + close blockers** |
| Tablet calendar targets | Not a named tablet pack | **H3 IMPLEMENT** |
| Owner inventory/commission UX (read) | SoR exists; UX incomplete for H | **H4 minimal** |
| Phase 50 polish | Tempting scope creep | **KEEP OUT** |

---

## Bottom line

```text
Existing RTL/i18n/a11y = PARTIAL PRECURSORS
Wave H exit = NOT MET on 3b79c0f
Wave H Production Acceptance = NOT STARTED
```
