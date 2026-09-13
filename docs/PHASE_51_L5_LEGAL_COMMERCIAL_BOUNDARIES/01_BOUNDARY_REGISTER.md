# L5 — In-product vs external boundary register

**Legend:** **In-product** = implemented / governed in this repository’s product + docs SoR. **External** = deployment-owned, vendor SaaS, or legal instrument outside the repo. **PARTIAL** = precursor exists but not complete for commercial claim. **MISSING** = no in-repo artifact found.

This table consolidates Phase 49 EXTERNAL callouts, L2 sale honesty, and Step 29 non-claims. It does **not** replace counsel, ToS, or contracts.

---

## Register

| Domain | Boundary | Status | Evidence / doc pointer |
|--------|----------|--------|------------------------|
| **Tenancy / platform tenant** | **In-product** | PASS-local | [`TENANT_CREATION_AND_PROVISIONING.md`](../TENANT_CREATION_AND_PROVISIONING.md); SA tenant directory; platform-admin modules |
| **Plans / plan versions** | **In-product** | PASS-local | [`SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md`](../SUPER_ADMIN_PLANS_AND_PLAN_VERSIONS.md); SA `/plans` |
| **Entitlements / limits** | **In-product** | PASS-local | [`SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`](../SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md) |
| **Add-ons / commercial overrides** | **In-product** | PASS-local | [`SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`](../SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md) |
| **Subscription assignment** | **In-product** | PASS-local | [`SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md`](../SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md) |
| **Runtime licensing / enforcement** | **In-product** | PASS-local | [`LICENSING_ARCHITECTURE.md`](../LICENSING_ARCHITECTURE.md); [`LICENSING_LIFECYCLE_STATE.md`](../LICENSING_LIFECYCLE_STATE.md); clinic subscription UI |
| **Sale packaging explanation** | **In-product** (docs) | PASS-local | [`PHASE_51_L2_PRICING_PACKAGING/`](../PHASE_51_L2_PRICING_PACKAGING/) |
| **Payment collection / Stripe / checkout** | **External / future** | **PARTIAL** | Licensing notes “future: Stripe webhook sync”; L2 [`02_WHAT_IS_NOT_SOLD.md`](../PHASE_51_L2_PRICING_PACKAGING/02_WHAT_IS_NOT_SOLD.md); catalog discovery external billing **partial** |
| **External billing provider as full SoR** | **External** | **PARTIAL** | [`SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md`](../SUPER_ADMIN_V4_STEP01_CATALOG_ENTITLEMENT_DISCOVERY.md) |
| **PHI handling expectations (ops)** | **In-product** (ops rules) | PASS-local | No PHI in Super Admin expansion; SECURITY_RUNBOOKS / K7 / portal ops “no PHI in tickets”; inventory owner-report PHI gated |
| **HIPAA / GDPR certification claims** | **External / out-of-scope** | OUT / never claim | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) (certification row: never claim) |
| **Customer Terms of Service** | **External** (legal instrument) | **MISSING** in `docs/` | No `docs/*terms*` / ToS package found at L1/L5 discovery |
| **Customer Privacy Policy** | **External** (legal instrument) | **MISSING** in `docs/` | No `docs/*privacy*` policy package found; ops PHI rules ≠ privacy policy |
| **Deploy topology / k8s / CD (D-17)** | **External** | PASS-local (documented EXTERNAL) | Step 29; [`PHASE_49_K5_DEPLOY_ROLLBACK/`](../PHASE_49_K5_DEPLOY_ROLLBACK/) `04_EXPLICIT_OUT.md` |
| **On-call / paging SaaS** | **External** | PASS-local (documented EXTERNAL) | [`PHASE_49_K7_INCIDENT_BASICS/`](../PHASE_49_K7_INCIDENT_BASICS/); L4 handoff |
| **Ticket systems (Jira/ServiceNow)** | **External** | PASS-local (documented EXTERNAL) | K7 external interface |
| **Offsite backup / PITR / multi-region DR** | **External** | PASS-local (documented EXTERNAL) | [`PHASE_49_K3_BACKUP_RESTORE/03_EXTERNAL_BOUNDARIES.md`](../PHASE_49_K3_BACKUP_RESTORE/03_EXTERNAL_BOUNDARIES.md); [`DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) |
| **In-repo backup drill / cutover SoR scripts** | **In-product** (ops packaging) | PASS-local / PARTIAL drill | K3 package; full-data restore fixture debt noted in Phase 49 |
| **APM / SIEM** | **External** | PASS-local (documented OUT) | [`PHASE_49_K4_OBSERVABILITY_ALERTING/04_EXPLICIT_OUT.md`](../PHASE_49_K4_OBSERVABILITY_ALERTING/04_EXPLICIT_OUT.md) |
| **In-repo health / metrics surfaces** | **In-product** | PASS-local | K4 readiness; `/health/*`, `/metrics` |
| **Tenant isolation / RLS posture** | **In-product** | PASS-local | K6 packaging; Platform DB security gates |
| **Deferred UX (D5 picker, contrast, widget names)** | **In-product** (deferred) | **DEFERRED** | [`PHASE_51_L1_DISCOVERY_INVENTORY/06_DEFERRED_REGISTER_SEED.md`](../PHASE_51_L1_DISCOVERY_INVENTORY/06_DEFERRED_REGISTER_SEED.md) — not commercial SoR |

---

## Reading path

1. This register (boundaries).  
2. L2 [`01_WHAT_WE_SELL.md`](../PHASE_51_L2_PRICING_PACKAGING/01_WHAT_WE_SELL.md) / [`02_WHAT_IS_NOT_SOLD.md`](../PHASE_51_L2_PRICING_PACKAGING/02_WHAT_IS_NOT_SOLD.md).  
3. L4 [`03_RUNBOOK_INDEX.md`](../PHASE_51_L4_SUPPORT_OPS_HANDOFF/03_RUNBOOK_INDEX.md) for ops EXTERNAL list.  
4. Counsel / customer legal instruments — **outside this repo** when ToS/privacy are MISSING here.

---

## Honest commercial statement

```text
In-product: plans, entitlements, add-ons, subscription assignment, licensing enforcement, tenancy.
External / not claimed complete: Stripe/payment live, ToS/privacy docs in-repo, D-17 topology,
  paging/APM/SIEM, offsite/PITR, HIPAA/GDPR certification.
```
