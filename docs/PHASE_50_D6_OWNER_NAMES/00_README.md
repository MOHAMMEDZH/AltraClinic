# Phase 50 — D6 Owner-facing names

**Lineage:** `cb2e387+` (D4 tip) · **Branch:** `cursor/phase50-docs-ux-polish-kickoff`  
**Phase 50 PA:** PENDING (not claimed)  
**Inventory source:** `docs/PHASE_50_D1_DISCOVERY_INVENTORY/05_OWNER_UUID_VS_NAME_INVENTORY.md`

**Rule:** Name as primary only when an existing API/directory field provides it. Truncated UUID stays secondary (`title` / `aria-label` / monospace). Fail-closed. No new endpoints, Prisma fields, or invented labels.

---

## Delivered (names where SoR already provides them)

| Surface | Join source (existing APIs) | Display |
|---------|-----------------------------|---------|
| `InventoryReportsPage` accountability rows — item | `useInventoryItems` → `itemDisplayName` | Name primary + truncated `inventoryItemId` secondary |
| `InventoryReportsPage` accountability rows — used-by | Identity `useUsers` + current user (`staffOptionLabel` / AccountableStaffSelect pattern) | Name primary + truncated `usedByUserId` secondary |
| `CommissionPage` provider column | Same identity directory join | Name primary + truncated `providerId` secondary |
| `CommissionRulesPage` rule list provider (optional third) | Same identity directory join | Name primary + truncated `providerId` secondary |

Shared presentational helper: `apps/clinic-dashboard/src/components/NamedIdentityDisplay.tsx` (+ unit RTL).

Owner-report / commission DTOs themselves still carry IDs only — D6 does **not** extend those payloads.

---

## Deferred (no name field on current DTO / not authorized join)

| Surface | Why deferred |
|---------|----------------|
| `DashboardWidgets` patient primary labels | Widget DTO has `patientId` only — no `patientName` (or equivalent). Do not invent; do not add patient endpoints in D6. |
| Owner-report row when item/staff missing from catalog/directory page | Fail-closed UUID-only (catalog pageSize/identity view limits). No new batch-name API. |
| Scheduling provider calendar labels, workflow requester, SA chips, etc. | Outside authorized D6 surface list. |
| D5 AppointmentForm clinical-catalog picker | Remains **DEFERRED** (CTO). |

---

## Out

- D5 picker · D7 · schema/SoR · new APIs · brand redesign · axe silence · Phase 50 PA claim  
