# Wave I — Implementation Slices (ordered)

**Status:** Planning only. **No schema/services/e2e product changes in this package.**  
Implementation requires a **later** CTO authority prompt.

**Recommended first slice after CTO accepts I0:** **I1 — Pack matrix inventory + npm/CI script wiring** (no new product).

---

## Dependency overview

```text
I0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs — pending CTO accept]
        │
        ▼
I1 Pack inventory + npm/CI wiring         ← preferred first implementation
        │
        ▼
I2 P0 pack runners green (incl. P0-10)
        │
        ▼
I3 P1 pack runners green (incl. P1-14, Arabic/RTL, a11y/tablet)
        │
        ▼
I4 Combined Traceability + Migration Clean/Upgrade wiring
        │
        ▼
I5 Regression/onepass + Implementation Review + External PA Precheck
```

Do **not** start I2–I5 in the same unauthorized big-bang. Prefer thin PRs after each CTO slice accept.

---

## Slice I0 — Kickoff package (this folder)

| | |
|--|--|
| **Deliverable** | This folder + evidence summary |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice I1 — Pack matrix inventory + npm/CI wiring — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Map every frozen pack name → existing Jest/PG/e2e paths; add `test:phase48-*` (or §12-aligned) npm scripts; document CI job names to invoke them — **wire existing tests only** |
| **Depends on** | I0 accepted; Waves A–H present @ `d53ff77+` |
| **Includes** | Inventory markdown or script table; `apps/api/package.json` scripts; optional thin CI workflow stubs that call scripts; no new product/SoR |
| **Exit of slice** | Every frozen pack has a named runnable command; CI plan documented; still may not all be green in one onepass |
| **Why first** | Unblocks I2–I5; proves AR-19 reuse without inventing product |
| **Risks** | Over-scoping into product fixes; inventing a second framework; reopening closed SoRs |

**Proposed I1 scope (for CTO when authorizing implementation):**

1. Authoritative pack → path inventory checked into docs or `apps/api/scripts/phase48-pack-matrix.*`.  
2. Add npm scripts e.g. `test:phase48-p0-catalog`, `test:phase48-p0-snapshot-pricing`, `test:phase48-p0-concurrency`, `test:phase48-p0-eligibility`, … mirroring §12 + remaining packs.  
3. Document CI job names (new or existing) that will call those scripts — do not require full green matrix in I1.  
4. Do **not** invent product features; do **not** rewrite Wave F/G/H SoR; do **not** add Vitest-as-API-pack framework.

---

## Slice I2 — P0 pack runners green (incl. P0-10)

| | |
|--|--|
| **Goal** | All P0 frozen packs pass via I1 runners on a single SHA |
| **Depends on** | I1 |
| **Includes** | Fix only genuine pack failures (minimal); quarantine flakes with deterministic fix |
| **Out** | New SoR; Phase 50 polish |

---

## Slice I3 — P1 pack runners green (incl. P1-14 + H packs)

| | |
|--|--|
| **Goal** | All P1 frozen packs pass via named runners (incl. Arabic/RTL, Accessibility/Tablet, Commission) |
| **Depends on** | I1; preferably I2 |
| **Includes** | Wire H2/H3 Playwright into pack CI identity if required by pack; minimal product fixes only if pack fails |
| **Out** | Phase 50 redesign; SoR reopen |

---

## Slice I4 — Combined Traceability + Migration Clean/Upgrade

| | |
|--|--|
| **Goal** | First-class Combined Traceability runner; wire A–F (and G/H if required) clean/upgrade validators into Migration packs |
| **Depends on** | I1 |
| **Includes** | npm scripts + CI; promote/extract R4-TRACE into pack gate if needed; fill G/H migration validator gaps only if freeze requires |
| **Out** | New migration SoR; destructive history rewrite |

---

## Slice I5 — Regression/onepass + Implementation Review + External PA Precheck

| | |
|--|--|
| **Goal** | Phase 48 onepass (or equivalent) + Release 47 Step 28/29 baselines green; lean review package; PA = PENDING EXTERNAL |
| **Depends on** | I1–I4 |
| **Deliverable** | Mirror Wave G/H review package style + evidence; **no** self-granted PA |

---

## Explicit non-slices

- Wave F/G/H SoR edits  
- Phase 49 / 50 / 51  
- Second test framework  
- Big-bang single PR for I1–I5 without intermediate review  

---

## Risk register (wave-level)

| Risk | Mitigation |
|------|------------|
| Mistaking A–H PR greens for Wave I exit | CURRENT_STATE_VS_EXIT + pack matrix gate |
| Inventing second framework | AR-19 OUT; Jest/PG only |
| Reopening closed SoRs “to make pack green” | CTO + product-failure bar |
| Silencing flakes | §13 quarantine + deterministic fix |
| Scope creep into Phase 50 polish | Exit text + non-goals |
