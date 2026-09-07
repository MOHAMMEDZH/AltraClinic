# Stock Request Dashboard Accountability (Round 10 B1)

## Old broken request body

Clinic Dashboard `fulfillStockRequestLine` posted:

```json
{ "quantity": 3, "notes": "optional" }
```

`usedByUserId` was omitted. Staff HTTP `FulfillStockRequestLineDTO` requires UUID `usedByUserId` → **HTTP 400**.

The client did not silently substitute the authenticated user (correct, because that would reintroduce P0-10). It simply never collected an accountable human.

## New request body

```ts
{
  quantity: number;
  usedByUserId: string;
  notes?: string;
}
```

Serialized by `buildFulfillStockRequestLineBody` and posted by `fulfillStockRequestLine`. Empty/whitespace `usedByUserId` throws `ACCOUNTABLE_STAFF_REQUIRED` **before** `fetch`. Empty string is not sent.

Matches backend `FulfillStockRequestLineDTO` (`quantity` positive number, `usedByUserId` UUID, optional `notes`).

## Explicit selector / data source

Component: `AccountableStaffSelect`

Data sources (existing, no new identity API):

1. **Current authenticated user** — always listed as a selectable option from `useAuth()` (`userId`, name, email). **Not pre-selected.** Default option is empty placeholder.
2. **Tenant staff directory** — `useUsers({ status: 'active', limit: 200 })` from `features/user-management`, enabled only when `canViewUsers` (`api.identity` view: owner / general_manager / super_admin).

`inventory_manager` cannot list `/identity/users`. They still fulfill by **explicitly selecting themselves** from the current-user option. Owner/GM see the full active staff list plus themselves. No architecture redesign.

Merge helper: `mergeAccountableStaffOptions` (dedupes current user vs directory).

## recordedBy vs usedBy semantics

| Field | Source |
|-------|--------|
| `recordedByUserId` / `fulfilledBy` | authenticated fulfiller (API from `req.user`) — **never sent by dashboard body** |
| `usedByUserId` | explicitly selected staff UUID from the `<select>` |

Equality is allowed only when the operator selects that same person. The dashboard does not copy `user.userId` into the body unless that option was chosen.

## UI validation

- Accountable staff `<select required>` with empty placeholder.
- Submit (Issue stock / fulfill-all) calls `assertAccountableStaffSelected`.
- Missing selection: `AuthFormField` error `inventory.stockRequests.accountableStaffRequired`; mutation **not** called.
- Quantity input unchanged. Notes remain optional on the API; the fulfill UI did not previously collect notes and still does not.

## i18n (EN + AR)

| Key | English | Arabic |
|-----|---------|--------|
| `accountableStaff` | Accountable staff member | الموظف المسؤول |
| `accountableStaffHelp` | Select the staff member responsible for this stock usage | اختر الموظف المسؤول عن استخدام المخزون |
| `accountableStaffRequired` | Accountable staff member is required | الموظف المسؤول مطلوب |
| `accountableStaffPlaceholder` | Select accountable staff… | اختر الموظف المسؤول… |

File: `apps/clinic-dashboard/src/i18n/inventory-messages.ts`

## Dashboard tests

| File | Proof |
|------|-------|
| `fulfill-stock-request-body.test.ts` | Missing selection throws; selected UUID serialized; current user not injected; notes omitted when blank |
| `inventory-api.fulfill.spec.ts` | Runtime `fetch` body is `{ quantity, usedByUserId, notes? }`; empty usedBy never hits network |
| `useInventory.fulfill.spec.tsx` | Mutation forwards explicit `usedByUserId`; does not substitute auth user |
| `AccountableStaffSelect.spec.tsx` | Empty default; inventory_manager does not query identity; owner lists directory UUID; required error |
| `StockRequestsPage.fulfill.spec.tsx` | No selection → blocked + alert; distinct UUID sent; same current user only after select; quantity preserved; 403 mapped to `permissionDenied` |
| `accountable-staff-options.test.ts` | Merge/dedupe options |
| `e2e/inventory-workflows.spec.ts` | Explicit `selectOption` on “Accountable staff member” before Issue stock |

## API compatibility proof

Dashboard serialized body:

```json
{ "quantity": 3, "usedByUserId": "<selected-uuid>", "notes": "ward A" }
```

Backend HTTP (`wave-c-http-permission`):

| Case | Status | Handler |
|------|--------|---------|
| Missing `usedByUserId` | 400 | not called |
| Malformed `usedByUserId` | 400 | not called |
| `{ quantity, usedByUserId }` | 2xx | `fulfilledBy` from auth, `usedByUserId` from body |
| `{ quantity, usedByUserId, notes }` (dashboard contract) | 2xx | notes forwarded; usedBy ≠ recorder unless body UUID equals auth |

No backend compatibility shim. Old `{ quantity }` still 400.
