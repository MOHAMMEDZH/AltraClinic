# D4 — Wave H3/H4 vs progressive CI story

**Rule:** Document the story. Wire into progressive **only** if already trivial / path already covered. Do **not** invent required GH Checks or a new workflow brand.

---

## Existing CI surfaces (unchanged brands)

| Surface | Workflow / job | What it runs |
|---------|----------------|--------------|
| Progressive inventory | `.github/workflows/clinic-dashboard-ci.yml` → `progressive-inventory` | Explicit Playwright file lists (Batches C–E). Includes `e2e/scheduling-a11y.spec.ts`, `e2e/ai-a11y.spec.ts`, beauty/encounters a11y, etc. |
| Inventory E2E | same workflow → `inventory-e2e` | Full `npm run test:e2e` (all Playwright specs under `apps/clinic-dashboard/e2e/`) |
| Wave H3 helper script | `apps/clinic-dashboard` → `npm run test:phase48-p1-accessibility-tablet` | `e2e/wave-h3-a11y-tablet.spec.ts` |
| Wave H4 helper script | `npm run test:phase48-owner-ux` | `e2e/wave-h4-owner-ux.spec.ts` |

---

## H3 / H4 coverage story (post-D4)

| Spec | Progressive list? | Inventory E2E (full suite)? | Notes |
|------|-------------------|-----------------------------|-------|
| `wave-h3-a11y-tablet.spec.ts` | **No** (not in progressive batch excerpt) | **Yes** (via `test:e2e`) | Functional a11y + tablet; **no** critical contrast disable on booking scopes |
| `wave-h4-owner-ux.spec.ts` | **No** | **Yes** | Owner UX RTL + axe; separate from progressive a11y list |
| `scheduling-a11y.spec.ts` | **Yes** | **Yes** | D4: axe scopes now match H3 reception chrome + calendar controls **without** `color-contrast` silence — progressive already covers this path |

**Trivial wire assessment:** Progressive already lists `scheduling-a11y.spec.ts`. Aligning that file to H3 scopes is the wire — **no** new job, check name, or workflow brand. Adding `wave-h3` / `wave-h4` filenames to progressive would expand CI surface area and is **not** required for D4.

---

## Operator reading order

1. Progressive CI green on `scheduling-a11y` ≈ reception-critical contrast gate (same scopes as H3 chrome/calendar).  
2. Full Inventory E2E still exercises Wave H3/H4 specs when that job runs.  
3. Full hub `#scheduling-region` contrast remains deferred — see `01_CONTRAST_FOLLOWUPS.md`.  
4. Local runs still skip when `E2E_API_READY` / API down (`e2e/helpers/api-ready.ts`); PR CI remains authoritative.
