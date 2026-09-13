# Phase 50 — Implementation Slices (ordered)

**Status:** Planning only. **No product/docs/UX implementation in this package.**  
Implementation requires a **later** CTO authority prompt per slice.

**Recommended first slice after CTO accepts D0:** **D1 — Discovery / inventory only** (no polish changes).

---

## Dependency overview

```text
D0 Kickoff / contracts (THIS PACKAGE)     [DONE as docs — pending CTO accept]
        │
        ▼
D1 Discovery / inventory ONLY             ← preferred first implementation
        │
        ▼
D2 Docs polish / operator clarity (thin)
        │
        ▼
D3 Bounded UX polish (thin, authorized candidates)
        │
        ▼
D4 A11y follow-ups (thin)
        │
        ▼
D5 Candidate: AppointmentForm clinical-catalog picker
   (only if CTO authorizes — else remain deferred)
        │
        ▼
D6 Candidate: Owner UX names vs truncated UUIDs
        │
        ▼
D7 Implementation Review + External PA Precheck
```

Do **not** start D2–D7 in the same unauthorized big-bang. Prefer thin PRs after each CTO slice accept.

---

## Slice D0 — Kickoff package (this folder)

| | |
|--|--|
| **Deliverable** | This folder |
| **Out** | Scope extract, current-vs-exit, acceptance criteria, slices |
| **Risk** | None to production |

---

## Slice D1 — Discovery / inventory ONLY — **FIRST IMPLEMENTATION**

| | |
|--|--|
| **Goal** | Inventory docs/operator clarity gaps, bounded UX candidates, a11y follow-ups, AppointmentForm picker status, and owner name-vs-UUID surfaces @ `1501190+` — **document gaps only** |
| **Depends on** | D0 accepted; Phase 49 closed @ `1501190` |
| **Includes** | Inventory markdown (paths, owners, PASS-local/PARTIAL/MISSING); proposed evidence formats; **no** polish as “done”; **no** SoR reopen |
| **Exit of slice** | Authoritative inventory checked in; CTO can authorize D2+ with known gaps |
| **Why first** | Prevents polish dump; keeps AppointmentForm picker and UUID display as **candidates** until authorized |
| **Risks** | Quietly implementing UX inside “discovery”; brand redesign creep; reopening Wave/Phase 49 SoR |

**Proposed D1 scope (for CTO when authorizing implementation):**

1. Operator docs surface list (Phase 49 packages, Step 29, SECURITY_RUNBOOKS, portal/ops) + clarity gaps.  
2. Bounded UX candidate list (labels, empty states, truncated IDs) with owners.  
3. A11y follow-up inventory tied to existing matrices/CI (not a new a11y product).  
4. AppointmentForm clinical-catalog picker: current deferral pointers + effort/risk note (candidate).  
5. Owner UX: list surfaces that show truncated UUIDs where names exist in SoR.  
6. Do **not** change product SoR; do **not** reopen Wave A–I / Phase 49; do **not** claim Phase 50 PA.

---

## Slice D2 — Docs polish / operator clarity

| | |
|--|--|
| **Goal** | Close authorized docs clarity gaps from D1 (cross-links, wording, operator paths) |
| **Depends on** | D1 |
| **Out** | New ops product; Phase 51; polish dump |

---

## Slice D3 — Bounded UX polish

| | |
|--|--|
| **Goal** | Thin authorized UX clarity fixes from D1 candidates |
| **Depends on** | D1 |
| **Out** | Full brand redesign; unauthorized surface rewrites |

---

## Slice D4 — A11y follow-ups

| | |
|--|--|
| **Goal** | Thin authorized a11y follow-ups with evidence on existing harnesses |
| **Depends on** | D1 |
| **Out** | Second a11y framework; silencing failures |

---

## Slice D5 — Candidate: AppointmentForm clinical-catalog picker

| | |
|--|--|
| **Goal** | If CTO authorizes: deliver deferred picker identity binding as a **thin** product slice with evidence |
| **Depends on** | D1; explicit CTO authorize for this candidate |
| **Out** | Silent SoR reopen of Wave H/I; shipping without authorize (remain deferred) |

---

## Slice D6 — Candidate: Owner UX names vs truncated UUIDs

| | |
|--|--|
| **Goal** | If CTO authorizes: replace truncated UUID-only displays with SoR-backed names on inventoried surfaces |
| **Depends on** | D1; explicit CTO authorize for selected surfaces |
| **Out** | Schema SoR rewrite; guessing display names without SoR |

---

## Slice D7 — Implementation Review + External PA Precheck

| | |
|--|--|
| **Goal** | Lean review package; **PA = PENDING EXTERNAL** |
| **Depends on** | D1–D6 (as authorized) |
| **Deliverable** | Mirror Phase 49 / Wave I review-package style + evidence; **no** self-granted PA |

---

## Explicit non-slices

- Phase 51 commercial launch  
- Wave A–I / Phase 49 SoR edits  
- Full brand redesign / polish dump  
- Second test framework  
- Big-bang single PR for D1–D7 without intermediate review  

---

## Risk register (phase-level)

| Risk | Mitigation |
|------|------------|
| Mistaking Phase 49 PA for Phase 50 exit | CURRENT_STATE_VS_EXIT + polish deliverables |
| Implementing inside “discovery” | D1 OUT = inventory only |
| Polish dump / brand redesign creep | Frozen OUT + thin-slice authorize |
| Shipping AppointmentForm picker without CTO | D5 candidate-only until authorize |
| Reopening closed Wave / Phase 49 SoRs | CTO + product-failure bar |
| Scope creep into Phase 51 | Frozen OUT list |
| Self-granted PA | Acceptance criteria block |
| Second test framework | Reuse existing CI/test philosophy |
