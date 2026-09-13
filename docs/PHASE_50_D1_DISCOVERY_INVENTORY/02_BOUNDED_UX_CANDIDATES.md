# D1 — Bounded UX candidates

**Lineage:** `1501190+` · **Owners:** Clinic Dashboard UX; Super Admin UX  
**Phase 50 claim:** none (candidates only — **do not implement in D1**)

---

## Surfaces found

| Item | Paths | Status |
|------|-------|--------|
| SA subscriptions: truncated UUID as primary link / tenant chip | `apps/super-admin/src/pages/subscriptions/SubscriptionsPages.tsx` | **PARTIAL** |
| SA sales ownership: raw `representativeId` as owner label | `apps/super-admin/src/pages/sales/SalesRepresentativeDetailPage.tsx` | **PARTIAL** |
| SA productivity / commission snapshots: ID in `<code>` | `…/productivity/ProductivityMetricsPanel.tsx`, `SalesCommissionSnapshotsListPage.tsx`, `SalesCommissionSnapshotDetailPage.tsx` | **PARTIAL** |
| SA EmptyState / Placeholder patterns | `apps/super-admin/src/ui/EmptyState.tsx`, `PlaceholderPage.tsx`; stronger empties on Catalog/Flags/Audit/Users | **PASS-local** (pattern) / **PARTIAL** (uneven adoption) |
| Clinic inventory accountability: truncated item/user IDs | `apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.tsx` | **PARTIAL** |
| Clinic commissions list: truncated `providerId` | `apps/clinic-dashboard/src/features/billing/CommissionPage.tsx` | **PARTIAL** |
| Clinic commission rules: full UUID in list line | `apps/clinic-dashboard/src/features/billing/CommissionRulesPage.tsx` | **PARTIAL** |
| Dashboard widgets: truncated patient UUID as primary | `apps/clinic-dashboard/src/features/dashboard/components/DashboardWidgets.tsx` | **PARTIAL** |
| Provider label fallback | `apps/clinic-dashboard/src/features/scheduling/config/scheduling-config.ts` (+ `AppointmentsPage.tsx`) | **PARTIAL** |
| Workflow inbox: truncated requester/workflow IDs | `apps/clinic-dashboard/src/features/workflow/components/enterprise/WorkflowApprovalInbox.tsx` | **PARTIAL** |
| Weak/hardcoded empty titles (import/backup/quotas) | e.g. `import-export/pages/ImportWizardPage.tsx`, backup-restore empties | **PARTIAL** |
| Commission deep-link hub confusion | `docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md` | **PARTIAL** |
| AppointmentForm (form present; catalog bind absent) | `…/scheduling/components/AppointmentForm.tsx` | **PASS-local** (form) — picker → [04](./04_APPOINTMENTFORM_CATALOG_PICKER_CANDIDATE.md) |

---

## Reuse patterns (prefer in D3)

```text
apps/super-admin/src/pages/TenantDirectoryPage.tsx          # displayName
apps/super-admin/src/pages/PlatformUsersPage.tsx
apps/clinic-dashboard/.../AccountableStaffSelect.tsx        # name join on write
apps/clinic-dashboard/.../ClinicalServicesPage.tsx          # displayName / stableKey
```

---

## Explicit OUT for D1

No UI code changes. No brand redesign. Ranked implementable set → D3 after CTO authorize.
