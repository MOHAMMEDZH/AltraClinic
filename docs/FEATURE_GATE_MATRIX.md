# Feature Gate Review Matrix

Date: 2026-06-15

## Scope
- Plans reviewed: Lite, Pro, Enterprise.
- Implemented plan vocabularies discovered in code:
  - Platform entitlements: starter, growth, enterprise.
  - Subscription domain: basic, standard, premium.
- Verification dimensions: UI restrictions, API restrictions, backend restrictions, database restrictions, quota enforcement.

## Executive Verification Status
- UI restrictions by plan: Not implemented.
- API restrictions by plan: Not implemented.
- Backend restrictions by plan: Partially implemented (single active-subscription gate in billing invoice creation; no tier-specific gating).
- Database restrictions by plan: Not implemented in running code (in-memory repositories); documented only.
- Quota enforcement: Partially implemented as metadata (plan limits modeled), but not enforced against resource creation/update flows.

## Findings (Ordered by Severity)
1. Critical: Plan model fragmentation breaks enterprise gate consistency.
   - Platform tier model is starter/growth/enterprise, while subscription model is basic/standard/premium.
   - Evidence: apps/api/src/modules/platform-admin/domain/value-objects/entitlement-plan.vo.ts, apps/api/src/modules/subscription/domain/value-objects/subscription-plan.vo.ts.
2. Critical: No plan-based enforcement in UI and API surfaces.
   - Dashboard routes are static and do not check plan entitlements.
   - Subscription and platform APIs are role-gated, not plan-gated for business features.
   - Evidence: apps/clinic-dashboard/lib/router.ts, apps/api/src/modules/subscription/api/subscription.controller.ts, apps/api/src/modules/platform-admin/api/platform-admin.controller.ts.
3. High: Quotas are defined but not enforced.
   - maxBranches/maxUsers are modeled and exposed, but no enforcement found in branch/user creation/update paths.
   - Evidence: apps/api/src/modules/platform-admin/domain/value-objects/entitlement-plan.vo.ts, apps/api/src/modules/platform-admin/domain/entities/platform-tenant.entity.ts.
4. High: Database-level gate enforcement is absent in runtime code.
   - Current runtime adapters are in-memory; no DB constraints/triggers/RLS enforcing plan tiers or quotas.
   - Evidence: apps/api/src/modules/subscription/infrastructure/in-memory-subscription.repository.ts.
5. Medium: Only one backend feature gate links business operations to subscription state.
   - Invoice creation requires active subscription for patient/customer.
   - No equivalent checks across scheduling, EMR, analytics, inventory, workflow, AI, etc.
   - Evidence: apps/api/src/modules/billing/application/handlers/create-invoice.handler.ts.

## Complete Feature Matrix (Current State)
Legend:
- Y = enforced and verified.
- P = partial enforcement.
- N = not enforced.
- U = undefined in code (no tier mapping).

| Feature / Domain | Lite | Pro | Enterprise | UI Restriction | API Restriction | Backend Restriction | Database Restriction | Quota Enforcement | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Home Dashboard | U | U | U | N | N | N | N | N | Route exists without plan checks. |
| Patients | U | U | U | N | N | N | N | N | Permission matrix exists, but no plan-tier gate. |
| Scheduling / Appointments | U | U | U | N | N | N | N | N | No plan-tier checks in scheduling create flow. |
| Queue | U | U | U | N | N | N | N | N | No plan-tier checks. |
| EMR Encounters | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Dental | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Beauty | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Inventory | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Billing Invoices | P | P | P | N | N | P | N | N | Active subscription required; no tier-based differentiation. |
| Subscription API | U | U | U | N | N | N | N | N | Role-gated only; plan model basic/standard/premium. |
| Commission | U | U | U | N | N | N | N | N | Role/business logic only. |
| Loyalty | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Notifications | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Audit | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Analytics Metrics | U | U | U | N | N | N | N | P | Pagination limits exist; not tied to plan tier. |
| Analytics Dashboards | U | U | U | N | N | N | N | P | Pagination limits exist; not tier-aware. |
| Analytics Reports / Export | U | U | U | N | N | N | N | N | No per-plan export/report quotas. |
| Reporting | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Workflow Engine | U | U | U | N | N | N | N | N | No plan-tier checks. |
| AI Models | U | U | U | N | N | N | N | N | Governance roles exist; no plan-tier checks. |
| Patient Portal | U | U | U | N | N | N | N | N | No plan-tier checks. |
| Platform Tenant Lifecycle | U | U | U | N | N | Y | N | P | Super-admin role gates lifecycle; plan changes allowed; not mapped to Lite/Pro labels. |
| Platform Privileged Access | U | U | U | N | N | Y | N | N | Security governance implemented, not plan-tier gating. |

## Evidence Index
- Plan tier definitions (platform): apps/api/src/modules/platform-admin/domain/value-objects/entitlement-plan.vo.ts
- Plan tier definitions (subscription): apps/api/src/modules/subscription/domain/value-objects/subscription-plan.vo.ts
- Platform lifecycle API: apps/api/src/modules/platform-admin/api/platform-admin.controller.ts
- Platform plan change handler: apps/api/src/modules/platform-admin/application/handlers/change-platform-tenant-plan.handler.ts
- Plan limits on tenant aggregate: apps/api/src/modules/platform-admin/domain/entities/platform-tenant.entity.ts
- Subscription endpoints: apps/api/src/modules/subscription/api/subscription.controller.ts
- Billing subscription gate: apps/api/src/modules/billing/application/handlers/create-invoice.handler.ts
- Dashboard route model: apps/clinic-dashboard/lib/router.ts
- Current permission catalog: docs/permission-matrix.json
- Runtime matrix validator: apps/api/scripts/validate-permission-matrix.mjs
- Database strategy (documented, not runtime-enforced): docs/DATABASE.md

## Gap-to-Closure Actions
1. Standardize tier taxonomy:
   - Adopt Lite/Pro/Enterprise as canonical keys and map legacy starter/growth/basic/standard/premium through a migration adapter.
2. Introduce a centralized feature gate service:
   - isFeatureEnabled(tenantId, featureKey), getQuota(tenantId, quotaKey), assertAllowed(...).
3. Enforce gates at all layers:
   - UI: hide/disable blocked routes and actions.
   - API: guard/interceptor precheck returning 402/403 style domain errors.
   - Backend: handler-level invariant checks.
   - DB: durable schema with tenant+plan constraints and usage counters.
4. Activate quota enforcement:
   - enforce maxUsers/maxBranches and add quotas for reports/exports/API usage where needed.
5. Add cross-module tests:
   - matrix-driven tests for Lite/Pro/Enterprise across all major controllers and handlers.

## Proposed Canonical Mapping
- Lite -> starter -> basic
- Pro -> growth -> standard
- Enterprise -> enterprise -> premium

This mapping should be temporary until all modules store and evaluate one canonical enum.
