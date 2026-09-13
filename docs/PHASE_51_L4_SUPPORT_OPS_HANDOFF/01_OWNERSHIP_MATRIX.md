# L4 — Who owns what on launch day

**SSOT for cutover ownership:** [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) **§8** (Form B roles).  
**SSOT for incidents:** [`PHASE_49_K7_INCIDENT_BASICS/`](../PHASE_49_K7_INCIDENT_BASICS/) + [`SECURITY_RUNBOOKS.md`](../SECURITY_RUNBOOKS.md).  
This page is a **launch-day reading aid** — not a new ownership SoR.

---

## Launch-day roles (thin)

| Role | Owns on launch day | Authoritative pointer |
|------|--------------------|------------------------|
| **Release Manager** | Rollback / restore authorization; SEV-1/2 release-block decisions; production access approval (with Security concurrence) | Step 29 §8.1–8.5 · K7 escalation |
| **Platform Operations** | Deploy/topology execution under EXTERNAL D-17; backup ops under K3 SoR; day-2 runbook execution | Step 29 §8.1–8.2 · K5 · K3 |
| **Platform Security on-call** | First response for security SEVs; contain per SECURITY_RUNBOOKS; page path (EXTERNAL tooling) | K7 · SECURITY_RUNBOOKS |
| **Platform Engineering lead** | Technical triage; escalate to RM; entitlement/licensing defects | Step 29 §8.3 · K7 chain |
| **Tenant Ops / Support** | Tenant-facing facts after RM/Security approve; portal/notification customer impact | K7 Comms · portal/notification runbooks |
| **Sales / commercial (explain only)** | Packaging explanation using L2 — **not** payment-live claims | [`PHASE_51_L2_PRICING_PACKAGING/`](../PHASE_51_L2_PRICING_PACKAGING/) |

---

## Default escalation chain (unchanged)

```text
Platform Security on-call → Platform Engineering lead → Release Manager
```

Sources: K7 · SECURITY_RUNBOOKS · Step 29 §8.3 / §8.4.

---

## Launch vs hardening

| Concern | Where |
|---------|--------|
| Day-2 hub | [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md) |
| Single-tenant go-live procedure | [`PHASE_51_L3_GOLIVE_CHECKLIST/`](../PHASE_51_L3_GOLIVE_CHECKLIST/) |
| This handoff | This package (L4) |
| Smoke evidence run | **L6** (not L4) |
