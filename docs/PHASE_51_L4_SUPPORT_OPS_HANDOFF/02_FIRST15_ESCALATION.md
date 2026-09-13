# L4 — First-15 / escalation path (launch day)

**Reuse:** K7 “First 15 minutes” and SEV table — do **not** invent a second IR playbook.

---

## Before declaring an incident

1. Confirm L3 stop-the-line still holds — [`PHASE_51_L3_GOLIVE_CHECKLIST/02_PRECONDITIONS_STOP_THE_LINE.md`](../PHASE_51_L3_GOLIVE_CHECKLIST/02_PRECONDITIONS_STOP_THE_LINE.md).  
2. If a stop-the-line gate failed → **STOP go-live**; escalate to Eng lead / Release Manager (do not “push through”).

---

## First 15 minutes (launch-day)

Follow K7 verbatim:

1. **Declare SEV** (K7 SEV-1…4 table).  
2. **Page on-call** — Platform Security (primary); tooling is **EXTERNAL**.  
3. **Contain** using matching [`SECURITY_RUNBOOKS.md`](../SECURITY_RUNBOOKS.md) section — never disable RLS / broaden tenant filters.  
4. **Preserve evidence** — request IDs, platform vs clinic principal, tenant A/B; no PHI expansion into Super Admin.  
5. **Health** — `/health/live`, `/health/ready` (K4); note deploy SHA (K5).  
6. **Escalate** — Eng lead → **Release Manager** for SEV-1/2, release-blocking, or restore/rollback (Step 29 §8.4).

Full text: [`PHASE_49_K7_INCIDENT_BASICS/00_README.md`](../PHASE_49_K7_INCIDENT_BASICS/00_README.md).

---

## Always escalate to Release Manager when

(K7 list — launch day same as hardening:)

- Confirmed/suspected **cross-tenant** leakage  
- **Release-blocking** security finding  
- Need **production DB restore** or **app rollback**  
- Unresolved Critical/High without block decision  
- Audit hole on sensitive actions  
- Plan/catalog integrity at risk  

---

## Launch-specific notes (thin)

| Situation | Action |
|-----------|--------|
| Provisioning / license assign fails mid go-live | STOP tenant path; Eng lead; do not invent wizard SoR |
| Customer asks “is payment live?” | Cite L2 `02_WHAT_IS_NOT_SOLD.md` — **PARTIAL**; do not invent Stripe status |
| Smoke not yet run under L6 | Do not claim smoke green; list precursors only (L3 §4) |
| Pager not wired | EXTERNAL ops gap — RM waiver or STOP cutover per Step 29 §8.3 / §11; **not** an in-repo SOC build |
