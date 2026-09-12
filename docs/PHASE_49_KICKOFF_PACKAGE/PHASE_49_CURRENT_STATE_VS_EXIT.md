# Phase 49 — Current State vs Exit Criteria

**Purpose:** Show that Release 47 + Phase 48 **security/QA greens are precursors**, not Phase 49 Production Hardening exit.  
**Base:** `9eac595` (PR #4 merge on `release47-step22-transfer-20260810-0353`).  
**Kickoff only — no Production Acceptance claim.**

---

## Phase 49 exit criteria (kickoff-bound)

```text
Secrets/config hygiene posture documented + verified against inventory
Backup/restore posture documented + restore drill readiness evidence
Observability/alerting readiness evidence (reuse existing surfaces)
Deploy/rollback runbooks published and exercised at thin-slice depth
Tenant isolation production checks green via reused runners where applicable
Incident basics documented (minimal)
Release 47 Step 28/29 (+ existing CI baselines) remain green
Phase 50 polish dump / Phase 51 launch = NOT REQUIRED
```

**Phase 49 exit ≠** “Wave I packs were green” or “Step 28 once passed historically.” Exit requires **hardening deliverables** on an accepting SHA after CTO-authorized slices.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **PASS-local** | Related evidence exists today (may lack Phase 49 packaging) |
| **PARTIAL** | Related docs/gates exist but incomplete for Production Hardening exit |
| **MISSING** | No Phase 49–grade evidence found at kickoff |

None of the rows below claim **Phase 49 exit complete**.

---

## Domain → evidence map @ `9eac595`

| Hardening domain | Existing precursors | Status |
|------------------|---------------------|--------|
| Secrets / config hygiene | Step 28 dep-audit / classify; env exclusivity patterns in Playwright/API CI; `.env` not committed as SoR | **PARTIAL** (gates exist; Phase 49 inventory + leak/fail-closed checklist not packaged) |
| Backup / restore posture | Postgres as SoR; migration clean/upgrade validators (Phase 48); no Phase 49 restore-drill package | **PARTIAL** / **MISSING** for restore drill |
| Observability / alerting readiness | Phase 45 Observability Center architecture + `api.observability`; health contributors; Step 29 matrices restored observability permission | **PARTIAL** (product/arch present; alerting readiness runbook/exit not Phase 49–closed) |
| Deploy / rollback runbooks | Scattered ops notes (`PATIENT_PORTAL_OPS_RUNBOOKS`, Super Admin rollback notes, wave review rollbacks) | **PARTIAL** (no single Production Hardening deploy/rollback SSOT) |
| Tenant isolation production checks | Extensive RLS / cross-tenant Jest+Postgres packs; Platform DB Security CI; Wave I pack matrix | **PASS-local** as product QA; Phase 49 needs **production-check packaging** (reuse, don’t rebuild) |
| Incident basics | Audit Center + events docs; no minimal Phase 49 incident playbook | **MISSING** / **PARTIAL** |
| Regression baselines | `test:step28-security-final-onepass`, `test:step29-release-final-onepass`; Clinic Dashboard Progressive + Inventory E2E green on Wave I tip | **PASS-local** as baselines — still required to **remain green**, not sufficient alone |

---

## Why Wave I / Step 28–29 “done” ≠ Phase 49 exit

1. Wave I closed **Enterprise QA packs** — not secrets inventory, restore drills, or deploy/rollback SSOT.
2. Step 28/29 prove **Release 47 security/final gates** — they do not publish Production Hardening runbooks or incident basics.
3. Observability architecture (Phase 45) ≠ Phase 49 alerting readiness acceptance.
4. Tenant isolation tests prove **product contracts**; Phase 49 still needs a thin **production-check** packaging layer (reuse runners).
5. No Phase 49 acceptance package / PA precheck exists yet (K0 is kickoff only).

---

## Top coverage gaps (for K1+)

| # | Gap | Blocks |
|---|-----|--------|
| 1 | No Phase 49 discovery inventory of secrets/config/backup/obs/deploy surfaces | K1 |
| 2 | No backup restore-drill procedure + evidence format | Backup/restore exit |
| 3 | No unified deploy/rollback runbook SSOT | Deploy/rollback exit |
| 4 | No minimal incident basics playbook | Incident exit |
| 5 | No Phase 49 review/PA package pattern yet | External PA |
