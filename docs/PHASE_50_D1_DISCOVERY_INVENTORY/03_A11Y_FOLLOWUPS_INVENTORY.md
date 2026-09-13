# D1 — A11y follow-ups inventory

**Lineage:** `1501190+` · **Owners:** Clinic Dashboard QA; Super Admin  
**Phase 50 claim:** none (inventory only)  
**Rule:** reuse existing Playwright / Vitest / axe patterns — **no second a11y framework**

---

## Surfaces found

| Item | Paths | Status |
|------|-------|--------|
| Clinic progressive a11y specs in CI | `.github/workflows/clinic-dashboard-ci.yml`; `apps/clinic-dashboard/e2e/*-a11y.spec.ts` | **PASS-local** |
| Legacy scheduling axe disables contrast | `apps/clinic-dashboard/e2e/scheduling-a11y.spec.ts` (`.disableRules(['color-contrast'])`) | **PARTIAL** |
| Wave H3 functional a11y (booking scoped) | `apps/clinic-dashboard/e2e/wave-h3-a11y-tablet.spec.ts` | **PARTIAL** (not in progressive batch list excerpt) |
| Contrast disable pattern elsewhere | `e2e/ai-a11y.spec.ts`, `beauty-a11y.spec.ts`, `beauty-workspace-a11y.spec.ts`, `encounters-a11y.spec.ts` | **PARTIAL** |
| Wave H3 vs legacy gap (documented) | `docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md` | **PARTIAL** |
| Wave H4 owner UX RTL + axe | `apps/clinic-dashboard/e2e/wave-h4-owner-ux.spec.ts` | **PASS-local** (spec) / **PARTIAL** (CI story) |
| Super Admin UI matrix a11y rows | e.g. `notifications-ui.spec.tsx` UI50–UI55; leads/productivity matrices | **PASS-local** |
| SA shell landmarks / main heading | `PageLayout.tsx` (`sa-page`), `PageHeader.tsx` (`#main-heading`); `shell.spec.tsx` | **PASS-local** |
| SA RTL/a11y Vitest | `*-rtl-a11y.spec.tsx`, `ui/ui-a11y.spec.tsx` | **PASS-local** |
| Phase 50 a11y follow-up package | — | **MISSING** (this inventory starts it; D4 implements) |

---

## Known follow-up gaps (for D4)

1. Re-enable / fix contrast where CI uses `disableRules(['color-contrast'])` — fail-closed, no silence.  
2. Decide H3 scope expansion vs keeping legacy scheduling disable (document, don’t invent new suite brand).  
3. Align Wave H3/H4 e2e with progressive CI story (optional wire — not required GH Checks invention).  
4. Close N/A Super Admin UI-matrix gaps only when product surfaces gain dialogs/invalid focus.  
5. Do **not** invent a second a11y framework (D4 OUT).
