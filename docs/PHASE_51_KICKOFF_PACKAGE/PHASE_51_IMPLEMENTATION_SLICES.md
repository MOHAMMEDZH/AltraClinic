# Phase 51 — Implementation Slices (ordered)

**Status:** Planning only. **No commercial-launch implementation in this package.**  
Implementation requires a **later** CTO authority prompt per slice.

**Recommended first slice after CTO accepts L0:** **L1 — Discovery / inventory only** (no launch checklists claimed “done”).

---

## Dependency overview

```text
L0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs — pending CTO accept]
        │
        ▼
L1 Discovery / inventory ONLY             ← preferred first implementation
        │
        ▼
L2 Pricing / packaging clarity (thin docs)
        │
        ▼
L3 Tenant onboarding go-live checklist
        │
        ▼
L4 Support / ops handoff
        │
        ▼
L5 Legal / commercial boundary documentation
        │
        ▼
L6 Launch smoke / go-live evidence format (+ authorized run)
        │
        ▼
L7 Deferred items register + Implementation Review + External PA Precheck
```

Do **not** start L2–L7 in the same unauthorized big-bang. Prefer thin PRs after each CTO slice accept.

---

## Slice L0 — Kickoff package (this folder)

| | |
|--|--|
| **Deliverable** | This folder |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice L1 — Discovery / inventory ONLY — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Inventory commercial-launch gaps @ `9a2e89d+` — pricing/packaging, onboarding, handoff, legal/commercial boundaries, smoke evidence precursors, deferred register — **document gaps only** |
| **Depends on** | L0 accepted; Phase 50 closed @ `9a2e89d` |
| **Includes** | Inventory markdown (paths, owners, PASS-local/PARTIAL/MISSING/DEFERRED); proposed evidence formats; **no** claiming launch-ready; **no** SoR reopen |
| **Exit of slice** | Authoritative inventory checked in; CTO can authorize L2+ with known gaps |
| **Why first** | Prevents fake “100% commercial complete”; keeps deferred items (D5 picker) visible |
| **Risks** | Quietly implementing product/SoR inside “discovery”; brand redesign; reopening Wave/Phase 49/50 SoR |

**Proposed L1 scope (for CTO when authorizing implementation):**

1. Pricing / packaging sale-clarity surfaces (plans, entitlements, licensing docs) + gaps.  
2. Tenant onboarding / go-live path inventory (OPERATOR_INDEX, Step 29, Phase 49 K5).  
3. Support / ops handoff precursors (K7 incident, SECURITY_RUNBOOKS, notification ops).  
4. Legal / commercial in-product vs external boundary candidates.  
5. Launch smoke precursors (Wave I packs, Step 28/29, Progressive/Inventory) + evidence format proposal.  
6. Deferred register seed from Phase 50 known limits (D5 picker DEFERRED; a11y/name DEFERs as noted).  
7. Do **not** change product SoR; do **not** reopen Wave A–I / Phase 49 / Phase 50; do **not** claim Phase 51 PA.

---

## Slice L2 — Pricing / packaging clarity

| | |
|--|--|
| **Goal** | Close authorized sale-clarity docs gaps from L1 |
| **Depends on** | L1 |
| **Out** | New billing/commercial engine; brand redesign |

---

## Slice L3 — Tenant onboarding go-live checklist

| | |
|--|--|
| **Goal** | Thin go-live checklist linked from operator hubs (reuse day-2 paths) |
| **Depends on** | L1 |
| **Out** | Fake production cutover; new deploy platform |

---

## Slice L4 — Support / ops handoff

| | |
|--|--|
| **Goal** | Document support/ops handoff using existing runbooks |
| **Depends on** | L1 |
| **Out** | New IR/SOC product; SoR reopen |

---

## Slice L5 — Legal / commercial boundary documentation

| | |
|--|--|
| **Goal** | Explicit in-product vs external boundary doc from L1 inventory |
| **Depends on** | L1 |
| **Out** | Legal advice as code; inventing external vendors |

---

## Slice L6 — Launch smoke / go-live evidence format

| | |
|--|--|
| **Goal** | Define and (if authorized) run launch smoke using existing harnesses |
| **Depends on** | L1 |
| **Out** | Second test framework / new “launch suite” brand |

---

## Slice L7 — Deferred register + Implementation Review + External PA Precheck

| | |
|--|--|
| **Goal** | Deferred items register current; lean review package; **PA = PENDING EXTERNAL** |
| **Depends on** | L1–L6 (as authorized) |
| **Deliverable** | Mirror Phase 49/50 review-package style + evidence; **no** self-granted PA |

---

## Explicit non-slices

- Wave A–I / Phase 49 / Phase 50 SoR edits as “launch work”  
- Full brand redesign / new product domains  
- Second test framework  
- Silent D5 AppointmentForm catalog picker (unless CTO reopens)  
- Big-bang single PR for L1–L7 without intermediate review  
- Claiming 100% commercial complete without evidence  

---

## Risk register (phase-level)

| Risk | Mitigation |
|------|------------|
| Mistaking Phase 50 PA for Phase 51 exit | CURRENT_STATE_VS_EXIT + launch deliverables |
| Implementing inside “discovery” | L1 OUT = inventory only |
| Fake commercial completeness | Acceptance criteria + evidence requirement |
| Reopening closed Wave / Phase 49/50 SoRs | CTO + product-failure bar |
| Shipping D5 picker without CTO reopen | Deferred register + frozen OUT |
| Brand redesign / new domain creep | Frozen OUT + thin-slice authorize |
| Self-granted PA | Acceptance criteria block |
| Second test framework | Reuse Step 28/29 + Wave I / Clinic CI |
