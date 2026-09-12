# Phase 49 K7 — Incident Basics (one-pager)

| Field | Value |
|-------|--------|
| **Slice** | K7 — Incident basics |
| **Status** | Thin packaging; **Phase 49 PA = PENDING EXTERNAL** |
| **Branch** | `cursor/phase49-production-hardening-kickoff` |
| **K6 tip** | `6164d05` |
| **K7 tip** | `72aeb9a` |
| **Authority** | CTO authorize K7 only; Phase 50/51 **NOT** started |

**SSOT for class-specific playbooks:** [`docs/SECURITY_RUNBOOKS.md`](../SECURITY_RUNBOOKS.md) — this one-pager does **not** rewrite or conflict with those procedures.

---

## SEV definitions (Phase 49 operational)

| SEV | Meaning | Typical examples | Release Manager |
|-----|---------|------------------|-----------------|
| **SEV-1** | Active or confirmed multi-tenant / PHI-scale blast; production integrity compromised | Confirmed cross-tenant leak; widespread secret exposure; audit disabled on sensitive paths | **Immediate** — treat as **RELEASE BLOCKED** until contained |
| **SEV-2** | Significant single-tenant or platform-control failure; customer-visible; hard to contain alone | Session compromise of privileged platform user; systemic entitlement/cache defect; Critical dep with release-block | **Notify within first 15 min**; RM decides block vs continue |
| **SEV-3** | Degraded service / limited blast; workaround exists | Rate-limit abuse contained; ambiguous notification retry; isolated config mis-deploy | Eng lead; escalate to RM if expands or blocks release |
| **SEV-4** | Low urgency / hygiene | Non-prod only; documentation gap; monitoring noise | Record; no RM required |

Map detailed detection → containment → evidence → rollback to the matching section in `SECURITY_RUNBOOKS.md` (credential leak §1, session §2, cross-tenant §3, entitlement/cache §4, audit §5, notifications §6, deps §7, rate-limit §8, plan mutation §9, release-blocking §10, CSP §11).

---

## First 15 minutes

1. **Declare SEV** (table above) and open an incident channel / ticket (external tooling — see interface).
2. **Page on-call** — Platform Security on-call (primary). Do not wait for perfect root cause.
3. **Contain** using the matching `SECURITY_RUNBOOKS.md` section — e.g. suspend credential, freeze exports, feature-flag deny route **only if kill-switch exists**. **Never** disable RLS / broaden tenant filters as mitigation (§3).
4. **Preserve evidence** — request IDs, principal type (platform vs clinic), tenant A/B, before/after deltas; no PHI expansion into Super Admin.
5. **Health check** — `/health/live`, `/health/ready` (K4 map); note deploy SHA / recent change (K5).
6. **Escalate** — Eng lead → **Release Manager** for SEV-1/2, release-blocking, or restore/rollback authorization (K5 / Step 29 §8.4).

---

## Comms

| Audience | What to say | Who |
|----------|-------------|-----|
| Internal incident channel | SEV, start time, systems, contain status, next check-in (15–30 min) | Incident commander (Security on-call or Eng lead) |
| Release Manager | Blast radius, RELEASE BLOCK recommendation, rollback/restore need | Security on-call / Eng lead |
| Customer / tenant ops | Facts only after RM/security approve; no speculative root cause | Tenant Ops / Platform Admin as directed |
| External pager / ticket | Link runbook § + request ID + accepting SHA | On-call (tooling external) |

---

## Escalation to Release Manager

**Always escalate when:**

- Confirmed or strongly suspected **cross-tenant** leakage (`SECURITY_RUNBOOKS.md` §3)
- **Release-blocking** security finding (§10)
- Need **production DB restore** or **app rollback** (K5 — RM authorizes)
- Unresolved Critical/High without block decision (§7)
- Audit hole on sensitive actions (§5)
- Plan/catalog integrity at risk (§9)

Default chain (unchanged from Security runbooks / Step 29):

```text
Platform Security on-call → Platform Engineering lead → Release Manager
```

---

## External on-call tooling (interface only)

| Concern | In-repo | External (deployment-owned) |
|---------|---------|------------------------------|
| Who to call | Roles above + Step 29 §8.3 | PagerDuty / Opsgenie / phone tree |
| Where tickets live | N/A | Jira / ServiceNow / etc. |
| Alert → human | Criteria in K4; signals `/health*`, `/metrics` | Scrape + page routing |
| Wiring SaaS in repo | **OUT** | Ops configures at cutover |

Do **not** invent IR/SOC product or require commercial APM/SIEM in-repo for Phase 49.

---

## Related packages

- K4 observability: `docs/PHASE_49_K4_OBSERVABILITY_ALERTING/`
- K5 deploy/rollback: `docs/PHASE_49_K5_DEPLOY_ROLLBACK/`
- K6 isolation check: `docs/PHASE_49_K6_TENANT_ISOLATION/`
- Review / PA precheck: `docs/PHASE_49_IMPLEMENTATION_REVIEW_PACKAGE/`

```text
Phase 49 PA = PENDING EXTERNAL
self-granted Phase 49 PA = NO
Phase 50 / Phase 51 = NOT AUTHORIZED
```
