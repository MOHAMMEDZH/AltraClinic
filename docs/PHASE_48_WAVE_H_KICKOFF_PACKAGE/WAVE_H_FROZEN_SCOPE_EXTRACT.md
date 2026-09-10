# Wave H Frozen Scope Extract

Kickoff package only — **not** an implementation or Production Acceptance claim.

**Canonical base:** `release47-step22-transfer-20260810-0353` @ `3b79c0fa45d2758e519a85e47d62fe9fb5f35f7e`  
**Wave G / PR #2:** ACCEPTED (merged) — do not reopen SoR.  
**Wave F / 3F:** CLOSED — do not reopen.

## Source authority (SSOT)

| Document | Binding use |
|----------|-------------|
| `docs/PHASE_48_ARCHITECTURE_FREEZE.md` | AR-02; P1-08; P1-12 |
| `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` | Wave H table + QA pack names + exit |
| `docs/PHASE_48_ENTERPRISE_QA_ACCEPTANCE_ARCHITECTURE.md` | RTL search/booking; Accessibility/tablet asserts |
| `docs/PHASE_48_ARCHITECTURE_REVIEW.md` | P1-08/P1-12 IMPROVE intent; Wave H domain list |
| `docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md` | Owner inventory/commission UX in Wave H |

Exact UI surfaces may vary; **semantics below are frozen**.

---

## Official Wave H name

**UX / Localization / Accessibility**

## Frozen Wave H table (verbatim-bound)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`:

| Item | Value |
|------|-------|
| P0/P1 | P1-08, P1-12 |
| ADRs | AR-02 |
| Domains | Arabic search; RTL booking; tablet/a11y; owner inventory/commission UX |
| QA | Arabic/RTL; Accessibility/Tablet |
| Entry | Core APIs from prior waves |
| Exit | Functional a11y gates (**not** Phase 50 polish dump) |

Frozen P1 QA pack names:

```text
P1 Arabic/RTL Pack = FROZEN
P1 Accessibility/Tablet Pack = FROZEN
```

---

## AR-02 (bound)

From Architecture Freeze ADR matrix:

| ADR | Decision | Authoritative SoR | Scope | Write owner | Historical rule | Tenant rule | QA pack | Wave | Status |
|-----|----------|-------------------|-------|-------------|-----------------|-------------|---------|------|--------|
| AR-02 | One identity + AR/EN translations/aliases + display-only override | ClinicalServiceTranslation/Alias | follows definition | catalog admin | snapshots freeze display | no language-row duplicates | Catalog / RTL | A/H | **FROZEN** |

**Wave A delivered** translation/alias SoR models. **Wave H owns** Arabic search quality + RTL booking acceptance that prove AR-02 in UX/API packs (IMPROVE, not re-author identity).

Freeze principles (bound):

```text
One identity + AR/EN translations/aliases + display-only override
Never duplicate clinical-service rows per language
```

---

## P1 items assigned to Wave H

| ID | Title (verbatim from freeze register) | Wave H? |
|----|---------------------------------------|---------|
| **P1-08** | Arabic catalog search + RTL booking quality | **YES** |
| **P1-12** | Accessibility + tablet reception | **YES** |

### P1-08 — Arabic catalog search + RTL booking quality (bound)

Architecture Review:

```text
P1-08 | AR-02 | Translations + search + RTL acceptance | IMPROVE
```

Enterprise QA Acceptance Architecture:

| Assert | Layers |
|--------|--------|
| RTL search/booking | Arabic catalog search + RTL booking | E2E + localization |

**In:**

- Catalog search finds services by Arabic `displayName` / aliases without creating language-row duplicates  
- Booking / scheduling UX usable under `dir=rtl` + `ar-SY` (or tenant Arabic locale) with functional quality gates  
- Localization strings for reception-critical paths where packs require them  

**Out (unless CTO expands):** full copyediting of every EN/AR string; marketing microsites; portal patient app redesign.

### P1-12 — Accessibility + tablet reception (bound)

Architecture Review:

```text
P1-12 | A11y/tablet acceptance criteria | Phase 48 functional a11y gates; Phase 50 polish only | IMPROVE UX
```

Enterprise QA:

| Assert | Layers |
|--------|--------|
| Accessibility/tablet | WCAG smoke + tablet calendar targets | UI + a11y |

**In:**

- Functional WCAG smoke on reception-critical surfaces (scheduling calendar booking path, catalog search results)  
- Tablet viewport target sizes / interaction for reception calendar (not desktop-only)  
- Fail-closed for defects that block booking/consent (per §11 Accessibility ownership)  

**Out:**

```text
Phase 50 polish dump = OUT
Visual redesign / brand refresh = OUT
```

---

## Owner inventory / commission UX (Wave H domain bound)

From Architecture Review / Addendum wave list:

```text
Wave H — UX / Localization / Accessibility (+ owner inventory/commission UX)
```

**Bounds (kickoff interpretation — confirm with CTO before H4):**

| In | Out |
|----|-----|
| Owner-facing **read** surfaces that make Wave C inventory accountability + Wave F commission accruals operable in Arabic/RTL/a11y | Changing AR-20/AR-21/AR-22 SoR, accrual math, settlement, or payroll |
| Minimal report/list UX gaps that block P1 Arabic/RTL or Accessibility packs from exercising owner views | New BI warehouse; POS; full commission admin redesign |

Do **not** reopen Wave F commission semantics or Wave C ledger rules.

---

## Explicit OUT of scope

- Wave I Enterprise QA Closure / onepass  
- Phase 49 / Step 30  
- Phase 50 polish dump  
- Reopening Wave F / Wave G SoR or migrations  
- Portal expansion, POS/cashbox, payroll engine  
- Dermatology EMR  
- Silent auto-book / waitlist SoR edits  
- Broad AI redesign (Batch E contrast was Wave G CI only)  
- Declaring Wave H ACCEPTED from this kickoff  

---

## Entry / exit (frozen)

| Gate | Text |
|------|-------|
| Entry | Core APIs from prior waves (A–G present on `3b79c0f`) |
| Exit | Functional a11y gates; Arabic/RTL pack green; **not** Phase 50 polish |
