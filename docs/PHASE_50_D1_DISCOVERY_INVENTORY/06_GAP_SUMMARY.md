# D1 — Gap summary (ranked → D2–D7 inputs)

**Lineage:** `1501190+` · **Phase 50 PA = PENDING**  
D5 / D6 marked **CANDIDATE** — not auto-started.

---

## Ranked gaps

| Rank | Gap | Status | Proposed slice | Notes |
|------|-----|--------|----------------|-------|
| 1 | No docs-root / Step 29–adjacent **operator INDEX**; K5 source index is closest hub | **MISSING** / **PARTIAL** | **D2** | Highest leverage for operator clarity |
| 2 | Phase 49 PA banners conflict (ACCEPTED vs PENDING) across kickoff/review files | **PARTIAL** | **D2** | Docs-only reconciliation |
| 3 | One-way cross-links (SECURITY / DR / portal / notifications ↔ Phase 49 K3/K5/K7) | **PARTIAL** | **D2** | Bidirectional thin links |
| 4 | `DISASTER_RECOVERY.md` aspirational vs K3 cutover SoR clarity | **PARTIAL** | **D2** | Day-2 path tightening |
| 5 | `NOTIFICATION_DELIVERY_OPERATIONS.md` not normal markdown; weak incident wiring | **PARTIAL** | **D2** | Normalize + link §6 / K7 |
| 6 | Truncated UUID / ID-primary clinic owner surfaces (inventory, commissions, dashboard) | **PARTIAL** | **D3** then **D6** | D3 labels/empties; D6 name joins |
| 7 | SA subscription / ownership ID-primary displays | **PARTIAL** | **D3** / **D6** | Ops polish candidates |
| 8 | Uneven empty states / hardcoded empty titles | **PARTIAL** | **D3** | Mirror strong EmptyState patterns |
| 9 | Axe `color-contrast` disableRules in multiple e2e specs | **PARTIAL** | **D4** | Fail-closed fixes; no silence |
| 10 | H3/H4 a11y CI story vs progressive batches | **PARTIAL** | **D4** | Wire/document — no new framework |
| 11 | AppointmentForm still enum serviceType — no catalog picker | **MISSING** (picker) | **D5 CANDIDATE** | **Recommend DEFER** |
| 12 | Owner UUID vs SoR name (ranked in `05_`) | **PARTIAL** | **D6 CANDIDATE** | After D1; authorize surfaces |
| 13 | Phase 50 review / external PA precheck | **MISSING** | **D7** | After authorized D2–D6 |

---

## Recommended authorize order (after D1 accept)

```text
D2 Docs polish / operator clarity     ← start here
D3 Bounded UX polish (thin)
D4 A11y follow-ups (thin)
D5 AppointmentForm catalog picker     ← CANDIDATE — prefer DEFER unless CTO wants IN
D6 Owner UUID → name                  ← CANDIDATE — authorize ranked surfaces
D7 Implementation Review + PA precheck
```

---

## D5 recommendation (explicit)

| Question | Answer |
|----------|--------|
| Should D5 picker be **IN** Phase 50 now? | **No — DEFER** |
| Why | Wave H/I explicit OUT; product SoR binding (enum → catalog id); higher risk than D2–D4; Phase 50 exit allows DEFERRED with rationale |
| When IN | Only after separate CTO authorize + thin evidence plan reusing clinical-catalog search |

---

```text
D1 complete = inventory only
No polish implemented
Phase 50 PA = PENDING
```
