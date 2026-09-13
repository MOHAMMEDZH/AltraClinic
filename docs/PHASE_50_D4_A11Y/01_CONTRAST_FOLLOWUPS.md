# D4 — Contrast follow-ups

**Inventory source:** `docs/PHASE_50_D1_DISCOVERY_INVENTORY/03_A11Y_FOLLOWUPS_INVENTORY.md`  
**Policy:** Prefer CSS/token fixes so axe passes. If a surface needs redesign, **DEFER** here and keep that file’s existing `disableRules(['color-contrast'])` with a pointer comment. Do **not** add contrast disables to new files.

---

## Closed in D4 (no `color-contrast` silence)

### 1) `scheduling-a11y.spec.ts` (highest-value clinic e2e)

| Before | After |
|--------|--------|
| Axe `.include('#scheduling-region')` + `.disableRules(['color-contrast'])` | Axe on `[data-testid="scheduling-reception-chrome"]` + `[data-testid="scheduling-calendar-controls"]` — **no** contrast disable |

Aligns with Wave H3 (`wave-h3-a11y-tablet.spec.ts`), which already gates these scopes without critical disableRules. Landmark / heading / keyboard tests in the same file are unchanged.

### 2) `ai-a11y.spec.ts` (mobile overview)

| Before | After |
|--------|--------|
| Mobile `#ai-region` axe disabled `color-contrast` (locked-card muted `#888`/`#a0a0a0` history) | Same include; **no** contrast disable |

Locked workspace cards already use AA text colors in `ai-enterprise.module.css` (`.workspaceCardLocked*`). Do not re-add silence if CI regresses — fix CSS.

---

## DEFERRED (redesign required — leave existing disables)

| Spec | Why deferred |
|------|----------------|
| Full `#scheduling-region` hub axe | Status badges / tinted timeline chrome (e.g. `StatusBadge.module.css` warning/info/success on light fills) need a coordinated badge redesign — **OUT** for D4 per CTO (legacy gap may remain documented). Wave H known limitation remains authoritative for H3 scope. |
| `beauty-a11y.spec.ts` | Full `#beauty-region` contrast not a one-token fix; keep disable + comment. |
| `beauty-workspace-a11y.spec.ts` | Workspace chrome same class of issue; keep disable + comment. |
| `encounters-a11y.spec.ts` (detail only) | Detail status badges (`EncounterDetailPage.module.css` / table badges) use semantic colors on tinted fills — redesign, not a silent token swap. List scan already runs **without** contrast disable. |

---

## Explicit non-goals

- Expanding `disableRules` to additional specs  
- Skipping tests to go green  
- Inventing a second a11y harness or workflow brand  
- Claiming Phase 50 PA  
