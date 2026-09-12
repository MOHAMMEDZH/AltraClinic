# D1 — Owner UUID vs name inventory (D6 candidate)

**Lineage:** `1501190+` · **Status:** **CANDIDATE** surfaces — not started  
**Phase 50 claim:** none (inventory only)

---

## Surfaces found

| Rank | Item | Paths | Status |
|------|------|-------|--------|
| 1 | Owner inventory accountability IDs | `apps/clinic-dashboard/src/features/inventory/InventoryReportsPage.tsx` | **PARTIAL** |
| 2 | Owner commissions list `providerId` | `apps/clinic-dashboard/src/features/billing/CommissionPage.tsx` | **PARTIAL** |
| 3 | Commission rules UUID in list | `apps/clinic-dashboard/src/features/billing/CommissionRulesPage.tsx` | **PARTIAL** |
| 4 | Dashboard patient primary labels | `apps/clinic-dashboard/src/features/dashboard/components/DashboardWidgets.tsx` | **PARTIAL** |
| 5 | Provider calendar label fallback | `scheduling/config/scheduling-config.ts` + `AppointmentsPage.tsx` | **PARTIAL** |
| 6 | Workflow approval requester | `workflow/.../WorkflowApprovalInbox.tsx` | **PARTIAL** |
| — | Beauty manager (already prefers name) | `beauty/components/ManagerAnalytics.tsx` | **PASS-local** (prefer name) |
| — | EMR audit actor (secondary truncate) | `emr/components/EncounterAuditPanel.tsx` | **PARTIAL** |
| — | SA subscriptions tenant/config chips | `apps/super-admin/.../SubscriptionsPages.tsx` | **PARTIAL** |
| — | SA sales ownership owner string | `SalesRepresentativeDetailPage.tsx` | **PARTIAL** |
| — | Integrations credential owner | `api-keys-integrations/.../CredentialDetailPage.tsx` | **PARTIAL** (may be acceptable ops) |

## Contrast: good name surfaces (reuse in D6)

```text
apps/super-admin/src/pages/TenantDirectoryPage.tsx     # displayName
apps/super-admin/src/pages/PlatformUsersPage.tsx
apps/clinic-dashboard/.../AccountableStaffSelect.tsx   # name join on write
apps/clinic-dashboard/.../ClinicalServicesPage.tsx
```

---

## Wave H pointer

`docs/PHASE_48_WAVE_H_IMPLEMENTATION_REVIEW_PACKAGE/KNOWN_LIMITATIONS.md` — owner inventory accountability UUID-only display noted as limitation.

---

## Explicit OUT for D1

No UUID→name code changes. No schema SoR. D6 implements only CTO-selected ranks.
