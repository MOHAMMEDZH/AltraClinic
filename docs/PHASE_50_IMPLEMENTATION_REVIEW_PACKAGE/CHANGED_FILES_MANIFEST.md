# Phase 50 — Changed Files Manifest (lean)

Representative paths only — not a full `git diff` dump.

## Docs

```text
docs/PHASE_50_KICKOFF_PACKAGE/**
docs/PHASE_50_D1_DISCOVERY_INVENTORY/**
docs/PHASE_50_D4_A11Y/**
docs/PHASE_50_D6_OWNER_NAMES/**
docs/PHASE_50_D7_REVIEW/**
docs/PHASE_50_IMPLEMENTATION_REVIEW_PACKAGE/**
docs/OPERATOR_INDEX.md
docs/DISASTER_RECOVERY.md                          # D2 cross-link / day-2
docs/NOTIFICATION_DELIVERY_OPERATIONS.md           # D2 normalize
docs/SECURITY_RUNBOOKS.md                          # D2 pointer
docs/RELEASE_47_STEP29_RELEASE_READINESS.md        # D2 pointer
docs/PHASE_49_*                                    # D2 PA banner reconcile (ACCEPTED)
```

## Clinic dashboard (D3 / D4 / D6)

```text
apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.tsx
apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.module.css
apps/clinic-dashboard/src/features/billing/CommissionPage.tsx
apps/clinic-dashboard/src/features/billing/CommissionRulesPage.tsx
apps/clinic-dashboard/src/features/billing/billing-layout.module.css
apps/clinic-dashboard/src/features/import-export/pages/ExportWizardPage.tsx
apps/clinic-dashboard/src/features/import-export/pages/ImportWizardPage.tsx
apps/clinic-dashboard/src/components/NamedIdentityDisplay.tsx
apps/clinic-dashboard/src/components/NamedIdentityDisplay.spec.tsx
apps/clinic-dashboard/src/i18n/billing-messages.ts
apps/clinic-dashboard/src/i18n/inventory-messages.ts
apps/clinic-dashboard/e2e/scheduling-a11y.spec.ts
apps/clinic-dashboard/e2e/ai-a11y.spec.ts
apps/clinic-dashboard/e2e/beauty-a11y.spec.ts
apps/clinic-dashboard/e2e/beauty-workspace-a11y.spec.ts
apps/clinic-dashboard/e2e/encounters-a11y.spec.ts
```

## Super Admin (D3 labels only)

```text
apps/super-admin/src/pages/subscriptions/SubscriptionsPages.tsx
apps/super-admin/src/i18n/messages.ts
```

## Explicitly not in Phase 50 product work

```text
D5 AppointmentForm clinical-catalog picker     # DEFERRED
New commission/inventory/identity endpoints    # OUT
Prisma / SoR schema changes                    # OUT
Required GH Checks / new a11y workflow         # OUT
```

## Explicitly not in manifest (uncommitted)

```text
apps/api/.ci-evidence/phase50-*
```
