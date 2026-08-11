# Leads and Sales Pipeline (Flexible Step 24)

**Status:** Accepted / Complete
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 24
**Authority:** Steps 01–23 + U01 Accepted/Complete; Step 23 Sales Representatives; Catalog/Plans/Entitlements SoRs.

Steps **01–23** + **U01**: Accepted/Complete.
Step **24**: Accepted / Complete.
Steps **25–29**: Not Authorized (no Trials, conversion, billing, commissions, payroll, PHI).

### Case C Attempt 2 (authoritative — narrow closure product fixes)

Attempt 1 executable green was **INVALIDATED** when product UI + `Cache-Control` headers changed during narrow closure. Authoritative sequence is Attempt **2**.

| Field | Value |
|-------|--------|
| Attempt | **2** |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-11T10:29:23.970Z` |
| Window | `2026-08-11T10:29:23.579Z` → `2026-08-11T11:15:07.374Z` (~45.7 min) |
| Runner | `npm run test:sales-leads-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Step 23 DB | **128/128** |
| Step 24 DB suite | **174/174** (includes C11–C24, F13–F30, H19–H50, P01–P12, query/index) |
| UI01–UI55 | **55/55** (`sales-leads-ui.spec.tsx`) |
| Catalog | Items **68** / Translations **136** / Aliases **68** / Rules **13** |
| Hygiene | remaining prohibited Step 24 artifacts = **0** |
| Acceptance | **Accepted** after narrow C/F/H/UI/P/query closure |

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
