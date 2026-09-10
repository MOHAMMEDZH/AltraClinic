# Wave H — Implementation Slices (ordered)

**Status:** Planning only. **No schema/services/e2e product changes in this package.**  
Implementation requires a **later** CTO authority prompt.

**Recommended first slice after CTO accepts H0:** **H1 — Arabic catalog search (P1-08 search half)**.

---

## Dependency overview

```text
H0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs — pending CTO accept]
        │
        ▼
H1 Arabic catalog search (P1-08 search)   ← preferred first implementation
        │
        ▼
H2 RTL booking quality (P1-08 booking)  ← E2E + localization gaps on scheduling/book
        │
        ▼
H3 Accessibility + tablet reception (P1-12)
        │
        ▼
H4 Owner inventory/commission UX (bounded, read)
        │
        ▼
H5 QA packs green + Implementation Review + External PA Precheck
```

Do **not** start H2–H5 in the same unauthorized big-bang. Prefer thin PRs after each CTO slice accept.

---

## Slice H0 — Kickoff package (this folder)

| | |
|--|--|
| **Deliverable** | This folder + evidence summary |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice H1 — Arabic catalog search (P1-08 search half) — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Prove/improve Arabic catalog search against AR-02 translations **and** aliases without language-row duplicates |
| **Depends on** | Wave A `ClinicalServiceTranslation` / `ClinicalServiceAlias`; list/search API |
| **Includes** | Search path includes active alias text; locale-aware proofs; unit/API (+ light UI if needed for pack); tenant isolation |
| **Exit of slice** | Arabic query returns correct canonical service(s); EN/AR queries do not fork identity; tests green |
| **Why first** | Smallest closed SoR/behavior; unblocks RTL booking E2E that depends on finding Arabic-named services; fewer UI layout risks than full RTL booking |
| **Risks** | Over-matching aliases; leaking inactive aliases; confusing display override with identity |

**Proposed H1 scope (for CTO when authorizing implementation):**

1. Audit `ClinicalCatalogService` search `where` — ensure `aliases.aliasText` (active) participates alongside `displayName` / `stableKey`.  
2. Add focused unit + postgres/API tests: Arabic `displayName`, Arabic alias, identity uniqueness, cross-tenant deny.  
3. Minimal clinic-dashboard catalog search wiring only if pack cannot exercise API-only — **no** redesign.  
4. No booking E2E depth (that is H2). No tablet pack (H3).

---

## Slice H2 — RTL booking quality (P1-08 booking half)

| | |
|--|--|
| **Goal** | Reception booking path under Arabic locale + `dir=rtl` meets Arabic/RTL pack |
| **Depends on** | H1 (can find services in Arabic) |
| **Includes** | Scheduling/book flow E2E; i18n gaps on critical controls; RTL layout blockers that fail pack |
| **Out** | Phase 50 polish; full string audit of all modules |

---

## Slice H3 — Accessibility + tablet reception (P1-12)

| | |
|--|--|
| **Goal** | Formal Accessibility/Tablet pack: WCAG smoke on reception-critical regions + tablet calendar targets |
| **Depends on** | H2 booking path stable enough to axe/tablet |
| **Includes** | Packize/extend scheduling a11y; tablet viewport calendar asserts; fix functional blockers only |
| **Out** | Phase 50 polish dump; disabling critical axe rules to pass |

---

## Slice H4 — Owner inventory / commission UX (bounded)

| | |
|--|--|
| **Goal** | Minimal owner read UX so inventory accountability + commission summaries are operable under H i18n/RTL/a11y bar |
| **Depends on** | Wave C/F SoRs unchanged; H2/H3 patterns |
| **Includes** | Gaps that block packs or owner ops; EN+AR strings; fail-closed permissions |
| **Out** | Accrual math, settlement, payroll, new ledgers |

---

## Slice H5 — Packs + Implementation Review + External PA Precheck

| | |
|--|--|
| **Goal** | P1 Arabic/RTL + Accessibility/Tablet packs green; lean review package; PA = PENDING EXTERNAL |
| **Depends on** | H1–H4 |
| **Deliverable** | Mirror Wave G review package style (lean) + evidence; **no** self-granted PA |

---

## Explicit non-slices

- Wave I / Phase 49 / Phase 50 polish dump  
- Wave F commission SoR edits; Wave G engagement SoR edits  
- Portal / POS / payroll  
- Big-bang single PR for H1–H4 without intermediate review  

---

## Risk register (wave-level)

| Risk | Mitigation |
|------|------------|
| Mistaking shell `dir=rtl` e2e for P1-08 done | Gate on Arabic/RTL **pack** asserts only |
| Phase 50 polish creep | Exit text + acceptance non-goals |
| Search aliases create false positives | Active-only + tenant scope + tests |
| Touching F/G SoR “while in UX” | Explicit OUT; H4 read-only |
| Axe disableRules as pass strategy | Forbidden for critical booking/consent paths |
