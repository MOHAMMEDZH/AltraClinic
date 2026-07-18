# Enterprise Permission System

> Matrix version: `2026-06-16.enterprise.v3`
> Last updated: 2026-06-16
> Architecture: Policy-Based RBAC backed by `permission-matrix.json`

---

## Overview

The system implements a **Policy-Based Role-Based Access Control (RBAC)** model.

- Every protected endpoint is decorated with `@RequirePermission(resourceId, action)`.
- The `PermissionGuard` (globally registered) evaluates the decorator against the permission matrix JSON at runtime.
- `super_admin` bypasses all checks — all other roles are evaluated against the matrix.
- The matrix is the **single source of truth** for all permission decisions.

### Permission Guard Chain (request order)

```
JwtAuthGuard → RolesGuard → PermissionGuard → Controller Handler
```

The `PermissionGuard` fails **CLOSED**: if the resource ID in a decorator is not found in the matrix, the request is denied — not allowed. This prevents misconfigured decorators from accidentally opening access.

---

## Roles

| Key                | Name              | Scope         | Description                                                     |
|--------------------|-------------------|---------------|-----------------------------------------------------------------|
| `super_admin`      | Super Admin       | Platform      | Full platform access — cross-tenant control plane. Bypasses all permission checks. |
| `owner`            | Owner             | Tenant        | Clinic owner — full access within the tenant.                   |
| `general_manager`  | General Manager   | Tenant        | Operational control within the tenant.                          |
| `doctor`           | Doctor            | Clinical      | Licensed physician — clinical and EMR access.                   |
| `dentist`          | Dentist           | Clinical      | Licensed dentist — dental clinical access.                      |
| `specialist`       | Specialist        | Clinical      | Specialist clinician — specialized clinical access.             |
| `nurse`            | Nurse             | Clinical      | Nursing staff — care coordination access.                       |
| `assistant`        | Assistant         | Operational   | Clinical/administrative assistant.                              |
| `receptionist`     | Receptionist      | Operational   | Front-desk reception — scheduling and check-in.                 |
| `accountant`       | Accountant        | Finance       | Finance and billing management.                                 |
| `inventory_manager`| Inventory Manager | Operations    | Inventory and supply chain management.                          |
| `patient`          | Patient           | Self-Service  | Self-service patient portal access.                             |

### Role Hierarchy (static inheritance — no DB storage)

```
super_admin ──────► (all)
owner ─────────────► (all tenant resources)
general_manager ───► (most operational resources)
doctor/dentist/specialist ──► (clinical resources)
nurse/assistant ───► (care coordination)
receptionist ──────► (scheduling, patients, notifications)
accountant ────────► (billing, commission, subscription, analytics)
inventory_manager ─► (inventory, analytics)
patient ───────────► (own portal, own notifications, own appointments)
```

---

## Actions

| Action   | Meaning                                                                               |
|----------|---------------------------------------------------------------------------------------|
| `view`   | Read / list records                                                                   |
| `create` | Create new records                                                                    |
| `update` | Modify existing records                                                               |
| `delete` | Delete or cancel records                                                              |
| `approve`| Approve, activate, pay, or finalize records requiring an authority sign-off           |
| `export` | Export data to CSV/PDF/external systems                                               |
| `manage` | Administrative configuration — rules, policies, settings governing resource behavior |

---

## Permission Matrix

Legend: ✅ = allowed, — = not allowed

### api.identity — Identity / User Management

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| update   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| delete   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |

### api.patients — Patients

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| update   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.scheduling — Appointments

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| update   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| delete   | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.queue — Queue Management

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| delete   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.emr — Electronic Medical Records

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| create   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| update   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.dental — Dental

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — |
| create   | ✅ | ✅ | ✅ | — | ✅ | — | — | ✅ | — | — | — | — |
| update   | ✅ | ✅ | ✅ | — | ✅ | — | — | ✅ | — | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.beauty — Beauty / Aesthetics

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ | ✅ | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ | — | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | ✅ | — | ✅ | — | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

> **Deprecated routes:** `POST /beauty/service` and `GET /beauty/service/:id` remain mapped for backward compatibility but are scheduled for removal (Phase 3, target 2026-09-15). Use `/beauty/record/*` — see [BEAUTY_API.md](./BEAUTY_API.md).

### api.inventory — Inventory

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | ✅ | ✅ | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | ✅ | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | — | ✅ | — |
| delete   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | ✅ | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | ✅ | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | ✅ | — |

### api.billing — Billing / Invoices

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.commission — Commission Management

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

> **`manage` on commission** = creating/editing commission rules (rate policies, thresholds).  
> Regular `create` = calculating a commission instance. Only `general_manager+` can define rules.

### api.subscription — Subscriptions

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |

### api.notifications — Notifications

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| update   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

> `update` on notifications = marking notifications as read (self-service for all roles).

### api.audit — Audit Logs

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| update   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| delete   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | — | — | — | — | — | — | — | — | — | — | — |

> Audit logs are append-only. `update`/`delete`/`manage` are `super_admin`-only for compliance corrections.

### api.loyalty — Loyalty Program

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.reporting — Reporting

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.analytics — Analytics

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.workflow — Workflow Engine

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | — |
| delete   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

### api.ai — AI Model Lifecycle

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | — |
| create   | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — | — | — |
| update   | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — | — | — |
| delete   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

> `approve` on AI = validate and deploy models. Deployment to production is a high-stakes action restricted to `general_manager+`.

### api.patient_portal — Patient Portal

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| create   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| update   | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ |
| delete   | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| approve  | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |

> `patient` can create/update their own portal account (caregiver grants) and view their own data.

### api.platform_admin — Platform Control Plane

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| create   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| update   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| delete   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| export   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | — | — | — | — | — | — | — | — | — | — | — |

> **Platform Admin is `super_admin` ONLY**. The guard enforces this at the controller layer; the domain also enforces it in handlers.

### api.tenant — Tenant Settings

| Action   | super_admin | owner | general_manager | doctor | dentist | specialist | nurse | assistant | receptionist | accountant | inventory_manager | patient |
|----------|:-----------:|:-----:|:---------------:|:------:|:-------:|:----------:|:-----:|:---------:|:------------:|:----------:|:-----------------:|:-------:|
| view     | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| create   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| update   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| delete   | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| approve  | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| export   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| manage   | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |

---

## API Endpoint Mapping

| HTTP Method | Path | Resource ID | Action |
|-------------|------|-------------|--------|
| POST | /identity/register | api.identity | create |
| GET | /identity/:id | api.identity | view |
| POST | /patients | api.patients | create |
| GET | /patients/:id | api.patients | view |
| POST | /scheduling/appointments | api.scheduling | create |
| GET | /scheduling/appointments/:id | api.scheduling | view |
| GET | /queue/waiting | api.queue | view |
| POST | /emr/encounters | api.emr | create |
| GET | /emr/encounters/:id | api.emr | view |
| POST | /dental/treatment | api.dental | create |
| GET | /dental/chart/:patientId | api.dental | view |
| GET | /beauty/metrics/summary | api.beauty | view |
| GET | /beauty/overview | api.beauty | view |
| GET | /beauty/analytics | api.beauty | view |
| GET | /beauty/record/:patientId | api.beauty | view |
| POST | /beauty/record | api.beauty | create |
| PATCH | /beauty/record/:patientId | api.beauty | update |
| POST | /beauty/record/:patientId/annotations | api.beauty | create |
| POST | /beauty/service | api.beauty | create ⚠️ **deprecated** |
| GET | /beauty/service/:id | api.beauty | view ⚠️ **deprecated** |
| POST | /inventory/item | api.inventory | create |
| POST | /inventory/item/consume | api.inventory | update |
| GET | /inventory/item/:itemId | api.inventory | view |
| GET | /inventory/items | api.inventory | view |
| POST | /billing/invoices | api.billing | create |
| POST | /billing/invoices/:id/line-items | api.billing | update |
| POST | /billing/invoices/:id/payments | api.billing | **approve** |
| POST | /billing/invoices/:id/cancel | api.billing | delete |
| GET | /billing/invoices/:id | api.billing | view |
| GET | /billing/invoices | api.billing | view |
| POST | /commissions/calculate | api.commission | create |
| POST | /commissions/rules | api.commission | **manage** |
| POST | /commissions/:id/approve | api.commission | approve |
| POST | /commissions/:id/pay | api.commission | approve |
| POST | /commissions/:id/dispute | api.commission | update |
| GET | /commissions/:id | api.commission | view |
| GET | /commissions | api.commission | view |
| POST | /subscriptions | api.subscription | create |
| POST | /subscriptions/:id/cancel | api.subscription | delete |
| GET | /subscriptions/:id | api.subscription | view |
| GET | /subscriptions | api.subscription | view |
| POST | /notifications | api.notifications | create |
| GET | /notifications/:id | api.notifications | view |
| GET | /notifications | api.notifications | view |
| POST | /notifications/:id/read | api.notifications | update |
| POST | /audit/entries | api.audit | create |
| GET | /audit/entries/:id | api.audit | view |
| GET | /audit/entries | api.audit | view |
| POST | /loyalty/accounts | api.loyalty | create |
| GET | /loyalty/accounts/:id | api.loyalty | view |
| POST | /loyalty/accounts/:id/earn | api.loyalty | update |
| POST | /loyalty/accounts/:id/redeem | api.loyalty | update |
| POST | /loyalty/accounts/:id/suspend | api.loyalty | approve |
| POST | /loyalty/accounts/:id/reactivate | api.loyalty | approve |
| POST | /loyalty/rewards | api.loyalty | create |
| GET | /loyalty/rewards | api.loyalty | view |
| POST | /reporting/reports | api.reporting | create |
| GET | /reporting/reports/:id | api.reporting | view |
| GET | /reporting/reports | api.reporting | view |
| POST | /analytics/metrics | api.analytics | create |
| GET | /analytics/metrics/:id | api.analytics | view |
| GET | /analytics/metrics | api.analytics | view |
| POST | /analytics/dashboards | api.analytics | create |
| GET | /analytics/dashboards/:id | api.analytics | view |
| GET | /analytics/dashboards | api.analytics | view |
| POST | /analytics/reports | api.analytics | create |
| GET | /analytics/reports/:id | api.analytics | view |
| GET | /analytics/reports | api.analytics | view |
| POST | /workflows | api.workflow | create |
| POST | /workflows/:id/advance | api.workflow | update |
| POST | /workflows/:id/cancel | api.workflow | delete |
| GET | /workflows/:id | api.workflow | view |
| GET | /workflows | api.workflow | view |
| POST | /ai/models | api.ai | create |
| POST | /ai/models/:id/validate | api.ai | approve |
| POST | /ai/models/:id/deploy | api.ai | approve |
| POST | /ai/models/:id/retire | api.ai | delete |
| GET | /ai/models/:id | api.ai | view |
| GET | /ai/models | api.ai | view |
| POST | /patient-portal/accounts | api.patient_portal | create |
| POST | /patient-portal/accounts/:id/activate | api.patient_portal | approve |
| POST | /patient-portal/accounts/:id/suspend | api.patient_portal | approve |
| POST | /patient-portal/accounts/:id/reactivate | api.patient_portal | approve |
| POST | /patient-portal/accounts/:id/deactivate | api.patient_portal | delete |
| PATCH | /patient-portal/accounts/:id/preferences | api.patient_portal | update |
| POST | /patient-portal/accounts/:id/caregiver-access | api.patient_portal | create |
| POST | /patient-portal/accounts/:id/caregiver-access/:grantId/revoke | api.patient_portal | delete |
| GET | /patient-portal/accounts/:id | api.patient_portal | view |
| GET | /patient-portal/accounts | api.patient_portal | view |
| POST | /platform/tenants | api.platform_admin | create |
| POST | /platform/tenants/:id/activate | api.platform_admin | approve |
| POST | /platform/tenants/:id/suspend | api.platform_admin | approve |
| POST | /platform/tenants/:id/resume | api.platform_admin | approve |
| POST | /platform/tenants/:id/archive | api.platform_admin | delete |
| PATCH | /platform/tenants/:id/plan | api.platform_admin | **manage** |
| POST | /platform/tenants/:id/privileged-access | api.platform_admin | create |
| POST | /platform/tenants/:id/privileged-access/:grantId/approve | api.platform_admin | approve |
| POST | /platform/tenants/:id/privileged-access/:grantId/reject | api.platform_admin | approve |
| POST | /platform/tenants/:id/privileged-access/:grantId/revoke | api.platform_admin | delete |
| GET | /platform/tenants/:id | api.platform_admin | view |
| GET | /platform/tenants | api.platform_admin | view |
| POST | /tenants | api.tenant | create |
| GET | /tenants/:id | api.tenant | view |

---

## Implementation Details

### Permission Guard

```typescript
// apps/api/src/modules/auth/api/guards/permission.guard.ts
@RequirePermission('api.billing', 'approve')
async recordPayment(...) { ... }
```

- The `@RequirePermission(resourceId, action)` decorator sets metadata on the handler.
- `PermissionGuard` reads the metadata, loads the matrix, and evaluates the request.
- `super_admin` always bypasses — no matrix lookup needed.
- Unknown `resourceId` values fail **CLOSED** with `403 Forbidden`.
- The matrix is loaded once at startup and cached in memory.

### Security Invariants

1. **Defense in Depth**: Module-specific guards (e.g. `BillingPermissionGuard`) run first for tenant scope validation. `PermissionGuard` adds the fine-grained action check.
2. **Fail Closed**: `PermissionGuard` denies access for any unknown resource ID.
3. **super_admin Bypass**: Enabled at the guard level; the domain layer still enforces business invariants regardless.
4. **Patient Role Restrictions**: `patient` cannot `approve` or `delete` any resource except their own portal account.
5. **Platform Admin Isolation**: `api.platform_admin` is exclusively `super_admin`. The guard, the domain handlers, and the policy service all enforce this independently.

### Adding a New Protected Endpoint

1. Add the resource to `apps/api/config/permission-matrix.json` with all 7 actions.
2. Decorate the controller method: `@RequirePermission('api.your_resource', 'action')`.
3. Sync `docs/permission-matrix.json`.
4. Re-run `npx ts-node prisma/seeds/permission-seeds.ts` to regenerate SQL seeds.
5. Update this document.

---

## Competing Architect Analysis

### Challenge: "Keep module-specific guards — they provide more control"

**Response**: Module guards implement ad-hoc role checks that create permission drift — each guard has different logic not tied to the central matrix. This:
- Makes auditing impossible (no single source of truth)
- Allows bugs to grant unintended access (false positives in guard, not caught by matrix)
- Requires reading 15+ files to understand who can do what

**Decision**: Keep module guards for **tenant-scope validation** (their original purpose), but add `@RequirePermission` on every method to enforce the centralized matrix. This provides defense-in-depth without removing existing behavior.

### Challenge: "Store permissions in DB for runtime editability"

**Response**: The permission matrix is a **contract** between the application and its security model. Changing it requires a code review + security review + deployment — not a DB update by an admin. Runtime editability creates:
- Security incident risk (admin can grant themselves super_admin)
- No audit trail for permission changes
- Extra DB latency on every request

**Decision**: Keep matrix as code. Phase 2: tenant-level permission **overrides** (e.g., custom roles) can be stored in DB and layered on top of the base matrix.

### Challenge: "7 actions is not enough — what about `export` vs `download`?"

**Response**: `export` covers both push-to-file and download actions. If clinical data export and admin export need separate controls, split into `export.clinical` and `export.admin` resource IDs in a future version.

### Challenge: "patient role has too much `update` access — e.g., marking notifications read"

**Response**: `update` on `api.notifications` is specifically for marking own notifications as read. Row-level enforcement (ensuring a patient can only mark their own) is the repository/service layer's responsibility, not the RBAC layer. RBAC controls **capability**, not **data scope**.

---

## Seeds Summary

| Category         | Count |
|------------------|-------|
| Roles            | 12    |
| Resources        | 21    |
| Permissions      | 147   |
| Role Assignments | 574   |

Seed files:
- `apps/api/prisma/seeds/permission-seeds.ts` — TypeScript generator
- `apps/api/prisma/seeds/permissions.seed.sql` — Generated SQL
- `apps/api/prisma/seeds/permissions.seed.json` — Generated JSON
