# Leads and Sales Pipeline (Flexible Step 24)

**Status:** Accepted / Complete  
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 24  
**Authority:** Steps 01–23 + U01 Accepted/Complete; Step 23 Sales Representatives; Catalog/Plans/Entitlements SoRs.

Steps **01–23** + **U01**: Accepted/Complete.  
Step **24**: **Accepted and complete** (authoritative Case C attempt **1**, 2026-08-11).  
Steps **25–29**: Not Authorized (no Trials, conversion, billing, commissions, payroll, PHI).

### Final Case C (authoritative Attempt 1)

| Field | Value |
|-------|--------|
| Attempt | **1** |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-11T09:04:05.060Z` |
| Window | `2026-08-11T09:04:04.682Z` → `2026-08-11T09:50:36.384Z` (~46.5 min) |
| Runner | `npm run test:sales-leads-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Step 24 DB suite | **89/89** |
| Step 23 regression | **128/128** |
| Catalog | `68 / 136 / 68 / 13` |
| Hygiene | remaining prohibited Step 24 artifacts = **0** |

---

## 1. Purpose

Lightweight commercial sales workflow for Healthcare ERP templates: capture leads, stage progression, ownership, requirements for **advisory Plan-fit**, without becoming entitlement/Plan/Subscription/Tenant SoR.

---

## 2. Aggregate (single SoR)

**Lead** is the only CRM aggregate. “Opportunity” semantics = the same lead after qualification; **no** separate opportunity table in Step 24.

| Field | Notes |
|-------|--------|
| id | UUID |
| stage | enum (immutable keys) |
| source | bounded enum |
| ownerRepresentativeId | FK → `platform_sales_representatives` |
| organizationName | business name |
| contactName / contactEmail / contactPhone / contactJobTitle | business contact only |
| facilityTypeKey | Catalog facility type key |
| specialtyKeys | JSON array (≤16) |
| desiredModuleKeys | JSON array (≤32) |
| estimatedUsers / estimatedProviders / estimatedLocations | optional bounded ints |
| nextActionType / nextActionDueAt / nextActionNote | follow-up metadata |
| demoScheduledAt / demoTimezone / demoStatus / demoNote | Platform-side demo only |
| wonLostReason | required on WON/LOST |
| linkedPlatformTenantId | optional existing PlatformTenant (never auto-create) |
| rowVersion | OCC |

Related: stage history, ownership history, notes; idempotency via `platform_sales_idempotency` (`sales_lead.*`).

**Not created:** opportunities table, pipeline_stages table, trials.

---

## 3. Stages

```text
NEW → CONTACTED → QUALIFIED → DEMO_SCHEDULED → PROPOSAL → WON | LOST
```

Terminal: WON, LOST. Stage changes never create Tenant/Trial/Subscription/Entitlement/Provisioning.

---

## 4–12. (Authorization, Plan-fit, Privacy, Won/Lost, API, Audit, Step 25, Migration)

Unchanged from implementation contract: assigned-only visibility unless `sales-lead.assign`; Plan-fit advisory with SoR delta 0; WON creates no Tenant/Trial/Subscription; Catalog `68/136/68/13`; Step 25 unauthorized.
