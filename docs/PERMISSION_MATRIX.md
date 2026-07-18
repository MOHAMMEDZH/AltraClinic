# Permission Matrix (Enterprise)

Version: 2026-06-15.enterprise.v1

This document defines role-based permissions for all implemented screens, APIs, actions, reports, exports, and operations.

## Scope
- Screens: Home, Patients, Appointments, Billing, Settings.
- APIs and operations: Identity, Tenant, Patients, Scheduling, Queue, EMR, Dental, Beauty, Inventory, Billing, Subscription, Commission, Loyalty, Notifications, Audit, Analytics, Reporting, Workflow, AI, Patient Portal, Platform Admin.
- Reports and exports: Analytics and Reporting exports, clinical and financial exports.

## Roles
- Super Admin
- Owner
- General Manager
- Doctor
- Dentist
- Specialist
- Nurse
- Assistant
- Receptionist
- Accountant
- Inventory Manager
- Patient

## Actions
- View
- Create
- Update
- Delete
- Approve
- Export

## Authoritative Matrix Source
- Machine-readable matrix: [docs/permission-matrix.json](docs/permission-matrix.json)
- Schema: [docs/permission-matrix.schema.json](docs/permission-matrix.schema.json)

The JSON matrix is the source of truth. It includes every resource and endpoint operation with explicit action mapping.

## Validation Rules
1. All 12 required roles must exist.
2. All six actions must exist in the canonical order: view, create, update, delete, approve, export.
3. Every resource must define permission sets for all six actions.
4. Every permission role must reference a declared role key.
5. Every operation must map to one of the six canonical actions.
6. Super Admin must be present in every action for every resource.
7. Platform Admin resources are super_admin-only for create/update/delete/approve.
8. Patient role is forbidden from approve/delete outside patient-portal resources.
9. Resource IDs must be unique.

## Enforcement Utility
- Runtime/CI validator: [apps/api/scripts/validate-permission-matrix.mjs](apps/api/scripts/validate-permission-matrix.mjs)
- Validation helper module: [apps/api/src/common/authorization/permission-matrix.validation.ts](apps/api/src/common/authorization/permission-matrix.validation.ts)

Run validation from apps/api:

```bash
node scripts/validate-permission-matrix.mjs
```

## Operational Notes
- This matrix reflects implemented endpoints in the current codebase.
- Where current domain policy services are broader or narrower than this matrix, this matrix is the governance baseline and should drive follow-up policy harmonization.
- New controllers/endpoints must be added to [docs/permission-matrix.json](docs/permission-matrix.json) before merge.
