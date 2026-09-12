# Phase 50 — D4 A11y follow-ups

**Lineage:** `596826b+` (D3 tip) · **Branch:** `cursor/phase50-docs-ux-polish-kickoff`  
**Phase 50 PA:** PENDING (not claimed here)  
**Rule:** reuse existing Playwright / axe patterns — **no second a11y framework**; **no silence via broader `disableRules`**

---

## Delivered

| Item | Path |
|------|------|
| Contrast follow-ups + DEFER list | `01_CONTRAST_FOLLOWUPS.md` |
| H3/H4 vs progressive CI story | `02_H3_H4_VS_PROGRESSIVE_CI.md` |

## Specs that no longer disable `color-contrast`

- `apps/clinic-dashboard/e2e/scheduling-a11y.spec.ts` — H3-proven scopes (reception chrome + calendar controls)
- `apps/clinic-dashboard/e2e/ai-a11y.spec.ts` — mobile overview (`#ai-region`)

## Explicitly deferred (existing `disableRules` retained + comment)

- `beauty-a11y.spec.ts`, `beauty-workspace-a11y.spec.ts`, `encounters-a11y.spec.ts` (detail)
- Full `#scheduling-region` hub axe (legacy Wave H gap)

## Out (this slice)

- D5 picker / D6 name joins / D7  
- Brand redesign / polish dump  
- New GH Checks or a11y workflow brand  
- Phase 50 PA claim  
