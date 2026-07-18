# Database Architecture Documentation

**Project:** Scalable Multi-Tenant B2B SaaS EMR & ERP  
**Schema Version:** 2026-06-15.v1  
**Engine:** PostgreSQL 16+  
**ORM:** Prisma 5.x  
**Reviewed by:** Principal DB Architect + Competing Architect Panel

---

## 1. Multi-Tenancy Strategy

### Decision: Shared Tables + Row-Level Security (RLS)

Three strategies were evaluated:

| Strategy | Isolation | Ops Cost | Scale | Decision |
|---|---|---|---|---|
| Database-per-tenant | Absolute | Prohibitive (N DBs) | Poor | Rejected |
| Schema-per-tenant | High | High (N schemas, migrations × N) | Poor | Rejected |
| **Shared tables + RLS** | Logical | Low (single DB, single migration) | Excellent | **Chosen** |

**How it works:**  
Every tenant-scoped table contains a non-nullable `tenant_id UUID` column. PostgreSQL Row-Level Security policies enforce that a session can only see rows matching `current_setting('app.current_tenant_id')::uuid`. The application sets this session variable inside every transaction via a Prisma middleware:

```sql
SET LOCAL app.current_tenant_id = '<tenant_uuid>';
```

RLS policy template applied to every tenant-scoped table:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <table>
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Weakness acknowledged by challenger:**  
A missing `SET LOCAL` call before a query would silently return no rows (not an error). Mitigation: a mandatory Prisma `$use` middleware throws if `app.current_tenant_id` is not set before any tenant-scoped operation. Platform-level operations (Super Admin) bypass RLS using the `BYPASSRLS` role.

---

## 2. Universal Column Conventions

Every table follows these conventions:

| Column | Type | Purpose |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Collision-free primary key (safe for offline-first sync) |
| `tenant_id` | `UUID NOT NULL` | Tenant isolation — indexed on every table |
| `created_at` | `TIMESTAMPTZ DEFAULT now()` | Creation timestamp — immutable |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by Prisma `@updatedAt` |
| `deleted_at` | `TIMESTAMPTZ NULL` | Soft delete sentinel — `NULL` = not deleted |

**Why UUIDs over auto-increment integers:**  
The spec requires offline-first sync (IndexedDB → server). Clients generate UUIDs locally before going online. Integer PKs would require a server round-trip and create conflicts on sync.

**Why `Decimal(18,4)` for money, not `Float`:**  
IEEE-754 floating-point cannot represent certain decimal values exactly (e.g. 0.1 + 0.2 ≠ 0.3). For a billing system, this causes unacceptable rounding errors on totals. `NUMERIC(18,4)` is stored exactly.

**Why soft deletes (`deleted_at`) instead of hard deletes:**  
Medical and legal compliance requires data retention. Specifically, the spec states: _"Historical data must never be deleted automatically upon suspension."_ Soft deletes allow reads while blocking new writes on suspended tenants.

---

## 3. Schema Overview — All Domains

### Domain Map

```
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM LAYER (cross-tenant, Super Admin only)            │
│  platform_tenants · privileged_access_grants                │
│  platform_subscriptions                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1:1
┌───────────────────────▼─────────────────────────────────────┐
│  TENANT LAYER                                               │
│  tenants · branches · users · user_role_assignments         │
│  refresh_tokens                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   [CLINICAL]     [FINANCIAL]    [OPERATIONS]
   patients        invoices       queue_tickets
   appointments    invoice_       inventory_items
   encounters        line_items   inventory_
   dental_records  invoice_         consumption_logs
   beauty_records    payments     workflows
   dental_tooth_   commission_    ai_models
     conditions      rules        outbox_events
   beauty_          commissions   notifications
     annotations   commission_
                     line_items
                   loyalty_
                     accounts
                   loyalty_
                     transactions
                   loyalty_rewards
                   clinic_
                     subscriptions
         ▼
    [PORTAL & AUDIT]
    portal_accounts
    caregiver_access_grants
    audit_entries
```

---

## 4. Table Reference

### `tenants`
Core identity record for each clinic/organization.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | — |
| `name` | VARCHAR(255) | Display name |
| `slug` | VARCHAR(100) UNIQUE | URL-safe subdomain identifier |
| `custom_domain` | VARCHAR(255) NULL | Enterprise white-label domain |
| `status` | `tenant_status` ENUM | ACTIVE \| SUSPENDED \| ARCHIVED |
| `lifecycle_status` | `tenant_lifecycle_status` ENUM | TRIAL \| ACTIVE \| SUSPENDED \| ARCHIVED |
| `timezone` | VARCHAR(50) | IANA timezone, default UTC |
| `locale` | VARCHAR(10) | BCP-47 code, default ar-SY |
| `data_retention_days` | INT | Default 365 |
| `features` | JSONB | Feature flags: `{ is_self_booking_enabled: bool }` |
| `trial_started_at` | TIMESTAMPTZ NULL | — |
| `trial_ends_at` | TIMESTAMPTZ NULL | Auto-transitions to SUSPENDED on day 31 |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |

**Indexes:** `slug`, `status`, `lifecycle_status`, `deleted_at`

---

### `branches`
Physical or logical branch locations under a tenant.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK → tenants | — |
| `name` | VARCHAR(255) | — |
| `name_ar` | VARCHAR(255) NULL | Arabic name |
| `is_active` | BOOL | — |

**Indexes:** `[tenant_id]`, `[tenant_id, is_active]`

---

### `users`
Staff and patient user accounts. Roles stored in junction table.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | — |
| `tenant_id` | UUID FK → tenants | — |
| `branch_id` | UUID NULL | Branch scoping |
| `email` | VARCHAR(255) | UNIQUE per tenant |
| `password_hash` | VARCHAR(255) | bcryptjs hash — never exposed |
| `is_active` | BOOL | — |
| `last_login_at` | TIMESTAMPTZ NULL | — |

**Unique:** `[tenant_id, email]`  
**Indexes:** `[tenant_id]`, `[tenant_id, is_active]`, `[tenant_id, deleted_at]`

---

### `user_role_assignments`
Explicit role grants — one row per role per user.

**Why not an array column:** Arrays cannot be indexed per element; role-level grant/revoke auditing requires discrete rows; future per-role expiry dates require a table.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID FK → users | — |
| `role` | `user_role` ENUM | SUPER_ADMIN \| OWNER \| DOCTOR \| ... |
| `granted_by` | UUID NULL | Actor who assigned the role |

**Unique:** `[user_id, role]`

---

### `patients`
Patient demographic record. Clinical data lives in encounter/dental/beauty records.

| Column | Type | Notes |
|---|---|---|
| `national_id` | VARCHAR(50) NULL | Syrian national ID |
| `blood_group` | VARCHAR(5) NULL | e.g. "A+" |

**Indexes:** `[tenant_id]`, `[tenant_id, phone]`, `[tenant_id, national_id]`, `[tenant_id, deleted_at]`

---

### `appointments`
Scheduled clinic visit slots.

| Column | Type | Notes |
|---|---|---|
| `provider_id` | UUID | FK to `users.id` (doctor/specialist) |
| `scheduled_start` | TIMESTAMPTZ | — |
| `scheduled_end` | TIMESTAMPTZ | — |
| `status` | `appointment_status` ENUM | PENDING \| CONFIRMED \| CANCELLED \| COMPLETED \| NO_SHOW |

**Indexes:** `[tenant_id, status]`, `[tenant_id, patient_id]`, `[tenant_id, provider_id]`, `[tenant_id, scheduled_start]`

---

### `encounters`
EMR clinical visit record — the timeline node. Diagnoses, medications, and observations are stored as JSONB arrays.

**Why JSONB arrays (not child tables):**  
These arrays are always loaded together per encounter. No use case queries "all diagnoses across all encounters" at the DB layer — that is an application-layer search over already-loaded encounter sets. Separate tables would add 3 joins per encounter fetch with no query benefit.

| Column | Type | Notes |
|---|---|---|
| `clinician_id` | UUID | FK to `users.id` |
| `diagnoses` | JSONB | `DiagnosisVO[]` — `[{ code, system, description, severity }]` |
| `medications` | JSONB | `MedicationVO[]` — `[{ name, dosage, frequency, duration }]` |
| `observations` | JSONB | `ObservationVO[]` — `[{ type, value, unit, recordedAt }]` |

---

### `dental_records` + `dental_tooth_conditions`
Odontogram aggregate. One `dental_records` row per patient holds the current JSONB snapshot. `dental_tooth_conditions` is the append-only event log of every individual tooth condition change.

| `dental_tooth_conditions` column | Type | Notes |
|---|---|---|
| `tooth_id` | VARCHAR(4) | FDI notation: "11"–"48" |
| `surface` | VARCHAR(20) NULL | mesial \| distal \| occlusal \| buccal \| lingual |
| `condition_code` | VARCHAR(50) | caries \| root_canal \| extraction \| implant \| crown |

---

### `beauty_records` + `beauty_annotations`
Anatomy map aggregate. Similar pattern to dental: snapshot + event log.

| `beauty_annotations` column | Type | Notes |
|---|---|---|
| `zone` | VARCHAR(100) | Anatomical zone label |
| `treatment` | VARCHAR(100) | botox \| filler \| laser \| prp |
| `coordinates` | JSONB | `{ x: Float, y: Float, view: "front"\|"back"\|"left"\|"right" }` |
| `parameters` | JSONB | `{ volumeCc, joulesUsed, skinDepthMm, machine }` |

---

### `inventory_items` + `inventory_consumption_logs`
Stock management with automatic consumption tracking.

| Column | Type | Notes |
|---|---|---|
| `sku` | VARCHAR(100) | UNIQUE per tenant |
| `quantity_on_hand` | DECIMAL(18,4) | Current stock level |
| `reorder_threshold` | DECIMAL(18,4) | Low-stock alert trigger |
| `expiry_date` | DATE NULL | Lot expiry — indexed for expiry alerts |
| `lot_number` | VARCHAR(100) NULL | Batch/lot tracking |

`inventory_consumption_logs` is append-only. Every treatment that triggers auto-consumption writes here with `encounter_id` linkage.

---

### `queue_tickets`
One ticket per appointment for the Smart Waiting Room TV view.

| Column | Type | Notes |
|---|---|---|
| `status` | `queue_ticket_status` ENUM | WAITING \| SERVING \| COMPLETED \| SKIPPED |
| `checked_in_at` | TIMESTAMPTZ NULL | When patient checked in at reception |
| `served_at` | TIMESTAMPTZ NULL | When patient was called |
| `wait_time_seconds` | INT NULL | Computed metric for analytics |

---

### `invoices` + `invoice_line_items` + `invoice_payments`
Double-entry-safe billing. Amounts use `DECIMAL(18,4)`. Discounts and taxes are per line item.

| Column | Type | Notes |
|---|---|---|
| `invoice_number` | VARCHAR(50) | UNIQUE per tenant |
| `currency` | VARCHAR(3) | ISO 4217, default "SYP" |
| `amount_subtotal` | DECIMAL(18,4) | Sum of line item subtotals |
| `amount_discount` | DECIMAL(18,4) | Sum of discount amounts |
| `amount_tax` | DECIMAL(18,4) | Sum of tax amounts |
| `amount_total` | DECIMAL(18,4) | subtotal - discount + tax |
| `amount_paid` | DECIMAL(18,4) | Running total of payments |

---

### `commission_rules` + `commission_calculations` + `commission_line_items`
Automated staff commission engine. Rules are matched by `provider_id` and/or `service_type` at calculation time.

| `commission_rules` column | Type | Notes |
|---|---|---|
| `rate_type` | `commission_rate_type` ENUM | PERCENTAGE \| FIXED_AMOUNT |
| `rate_value` | DECIMAL(10,4) | % or fixed amount |
| `minimum_threshold` | DECIMAL(18,4) NULL | Min base amount to trigger commission |
| `maximum_cap` | DECIMAL(18,4) NULL | Ceiling on commission payout |

---

### `loyalty_accounts` + `loyalty_transactions` + `loyalty_rewards`
Tiered loyalty engine. Transactions are append-only with `balance_after` denormalized for O(1) current balance reads without scanning the full ledger.

| `loyalty_transactions` column | Type | Notes |
|---|---|---|
| `type` | `loyalty_transaction_type` ENUM | EARN \| REDEEM \| ADJUST \| EXPIRE |
| `points_amount` | INT | Positive for EARN, negative for REDEEM |
| `balance_after` | INT | Denormalized running balance |

---

### `platform_tenants` + `privileged_access_grants` + `platform_subscriptions`
Super Admin control-plane. Completely separate from the Tenant identity domain.

**Key design: `PrivilegedAccessGrant` is a standalone table, not JSONB on `platform_tenants`.**  
Reasons: (a) expiry-based cron cleanup requires indexed queries on `(status, expires_at)`; (b) individual grant status updates require row-level locking; (c) security audit trail requires discrete rows.

| `platform_subscriptions` column | Type | Notes |
|---|---|---|
| `billing_cycle_months` | INT | Minimum 12 (spec requirement) |
| `price_per_month` | DECIMAL(18,4) | Displayed monthly, charged annually |
| `paid_manually_by` | UUID NULL | Phase 1: manual payment |
| `auto_renew` | BOOL | Phase 2: auto-billing hook |
| `renewal_attempted_at` | TIMESTAMPTZ NULL | Phase 2: cron job stamp |

---

### `portal_accounts` + `caregiver_access_grants`
Patient self-service portal with consent-based caregiver delegation (max 5 active grants).

---

### `notifications`
Multi-channel notification records with delivery status tracking.

| Column | Type | Notes |
|---|---|---|
| `channel` | `notification_channel` ENUM | EMAIL \| SMS \| PUSH \| IN_APP |
| `priority` | `notification_priority` ENUM | LOW \| MEDIUM \| HIGH \| CRITICAL |
| `metadata` | JSONB NULL | Context: `{ invoiceId, appointmentId, ... }` |

---

### `audit_entries`
**Append-only. No `updated_at`. Protected by a database trigger.**

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_entries is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entries_immutable
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

| Column | Type | Notes |
|---|---|---|
| `action` | VARCHAR(100) | e.g. "invoice.created", "user.role_assigned" |
| `resource_type` | VARCHAR(100) | e.g. "Invoice", "User" |
| `changes` | JSONB NULL | `{ field: { before, after } }` diff |
| `correlation_id` | UUID NULL | Request tracing across multiple audit entries |

**Production note:** When `audit_entries` reaches 100M+ rows, apply declarative table partitioning by `created_at` (monthly range partitions). The current `@@index([tenantId, createdAt])` is the base index for this partitioning axis.

---

### `outbox_events`
Transactional outbox for reliable domain event publishing. The processor job queries:

```sql
SELECT * FROM outbox_events
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 100
FOR UPDATE SKIP LOCKED;
```

`tenantId` is nullable — platform-level events (e.g. `PlatformTenantProvisioned`) are not tenant-scoped.

---

## 5. Index Strategy

### Naming Convention
All indexes follow the pattern: `[table]_[columns]_idx`

### Critical Query Paths and Their Indexes

| Query Pattern | Index |
|---|---|
| Load all appointments for a tenant on a date | `[tenant_id, scheduled_start]` |
| Find active queue for a tenant/branch | `[tenant_id, status]` on `queue_tickets` |
| Patient search by phone | `[tenant_id, phone]` on `patients` |
| Invoice lookup by number | UNIQUE `[tenant_id, invoice_number]` |
| Commission calculation by provider + period | `[tenant_id, provider_id]`, `[tenant_id, period_start, period_end]` |
| Dunning cron: tenants expiring in N days | `[contract_end_date]`, `[trial_ends_at]` on `platform_tenants` |
| Outbox processor: pick next PENDING events | `[status, created_at]` on `outbox_events` |
| JIT grant expiry cleanup | `[status, expires_at]` on `privileged_access_grants` |
| Audit trail for a specific resource | `[tenant_id, resource_type, resource_id]` |
| Audit trail time range | `[tenant_id, created_at]` |
| Soft delete filter | `[tenant_id, deleted_at]` on major tables |

---

## 6. Competitor Architect Challenges — Resolved

### Phase 1: Schema Design Challenges

| Challenge | Raised by | Resolution |
|---|---|---|
| "Use integer cents, not Decimal" | Perf Architect | Rejected. `DECIMAL(18,4)` is exact. Integer cents lose sub-unit precision needed for SYP exchange rate conversions. |
| "Store roles in array column" | Speed Architect | Rejected. Array prevents per-role index, role-level auditing, and future per-role expiry. Junction table `user_role_assignments` used. |
| "PrivilegedAccessGrant as JSONB in platform_tenants" | DB Architect | Rejected. Standalone table required for expiry cron queries, row-level locking, and security audit. |
| "Separate tables for diagnoses/medications" | Normalization Architect | Rejected for EMR. JSONB arrays are correct — always loaded together per encounter, no cross-encounter row queries needed. |
| "audit_entries will become the largest table" | Scale Architect | Accepted. Mitigation: append-only trigger, `[tenant_id, created_at]` index, documented partitioning path for production. |
| "Soft deletes require every query to filter deleted_at" | Query Architect | Accepted. Mitigation: Prisma global middleware adds `WHERE deleted_at IS NULL` to all finds automatically. |
| "Subscription table name collision" | DDD Architect | Resolved. `ClinicSubscription` (patient packages) and `PlatformSubscription` (SaaS billing) are distinct models with distinct purposes. |
| "Missing balanceAfter on loyalty ledger" | Financial Architect | Accepted and added. `balance_after` denormalized on each `LoyaltyTransaction` for O(1) balance reads. |
| "No RefreshToken table — security gap" | Security Architect | Accepted and added. SHA-256 hash stored, raw token never persisted. |

### Phase 2: Repository Implementation Challenges

| Challenge | Raised by | Resolution |
|---|---|---|
| "Global soft-delete middleware hides behaviour — debugging hell in production" | Operations Architect | Accepted concern. Mitigation: (1) middleware explicitly documented in `PrismaService`, (2) `DATABASE.md` §2 lists all soft-deletable models, (3) raw `$queryRaw` available for deleted-record access. The benefit (zero risk of missing `deletedAt IS NULL`) outweighs the debugging cost. |
| "Domain `UserRole` union is lossy vs. the 12-role permission matrix" | DDD Architect | Accepted. The domain `UserRole` type (`doctor | nurse | receptionist | admin | patient`) was defined before the permission matrix was finalised. Repository maps `admin` → `OWNER`. **TODO**: Align `UserRole` with `PermissionMatrix` in a dedicated domain refactor task. |
| "Use `upsert` for saves — but `upsert` on `audit_entries` breaks immutability" | Security Architect | Accepted for audit specifically. `PrismaAuditEntryRepository.save()` uses `create` not `upsert`, enforcing append-only at the ORM layer. The DB trigger is belt-and-suspenders. All other repositories correctly use `upsert`. |
| "Commission line items delete-recreate pattern is not idempotent at scale" | Perf Architect | Partially accepted. Delete-recreate is safe for small aggregates (commissions are per-provider per-period, typically <20 line items). For aggregates with hundreds of children (future growth), switch to an explicit diff-and-patch approach. Added `TODO` comment in repository. |
| "PrivilegedAccessGrant writes use `toPrimitives()` — bypasses grant-level validation" | Security Architect | Rejected. `toPrimitives()` is a read projection of already-validated props. The domain entity's business rules fire at command handler time. The repository layer only serializes; it does not bypass validation. |
| "Analytics repositories still in-memory — data is lost on restart" | Reliability Architect | Accepted. Analytics/Reporting modules (`MetricRepository`, `DashboardRepository`, `AnalyticsReportRepository`, `ReportRepository`) have no matching schema tables. They compute derived views from core tables. The correct fix is a read model / CQRS projection layer, which is Phase 3 of the roadmap. |
| "Prisma `$use` middleware is deprecated in Prisma 5+ in favour of query extensions" | Framework Architect | Accepted. `$use` works in Prisma 5 with a deprecation warning but will be removed in Prisma 6. Migration to `$extends({ query: { ... } })` is documented as a follow-up upgrade task. |
| "Mapper logic inline in repositories makes large aggregates hard to test" | Test Architect | Partially accepted. Inline mapping is fine for small/medium aggregates. For complex ones (PlatformTenant with nested PrivilegedAccessGrants, LoyaltyAccount with transactions), consider extracting `PlatformTenantMapper` and `LoyaltyAccountMapper` classes. Current approach accepted for velocity; refactor when mappers exceed 100 lines. |
| "`PrivilegedAccessGrant` field naming inconsistency (rejectionReason vs rejectedReason)" | Schema Architect | Resolved. Schema fields renamed from `rejectionReason`/`revocationReason` to `rejectedReason`/`revokedReason` to match domain entity naming conventions. `@default(PENDING)` corrected to `@default(PENDING_APPROVAL)` after enum value rename. Domain naming always wins to prevent cognitive load when crossing layer boundaries. |
| "`CaregiverAccessGrant` missing `grantedAt` field in schema" | Data Architect | Resolved. Added `grantedAt DateTime @default(now())` to schema. Changed `grantedBy` from `@db.Uuid` to `@db.VarChar(255)` to allow both UUID and display-name grants. Repository now reads `g.grantedAt` instead of falling back to `g.createdAt`. |
| "`LoyaltyTransaction` missing `tenantId` in repository create" | Multi-tenancy Architect | Resolved. `tenantId` was present in schema model but missing from repository `create` data block. Fixed by passing `account.tenantId` explicitly. This was a silent data integrity bug — RLS would have blocked queries on transactions if `tenantId` was null. |
| "Patient repository maps both `firstNameAr` and `firstNameEn` to the same value" | I18n Architect | Accepted as pragmatic interim solution. Domain `PatientNameVO` currently has a single `firstName`/`lastName` pair. When the domain is extended to support bilingual names, the repository must be updated to accept and pass `nameEn`/`nameAr` separately. **TODO**: Extend `PatientNameVO` to hold both Arabic and English names natively. |
| "Queue `SKIPPED` status has no domain equivalent — silently mapped to `completed`" | DDD Architect | Partially accepted. `SKIPPED` is a valid operational state (patient skipped by front desk) that exists in the schema but not in the domain entity. The downgrade to `completed` loses information. **TODO**: Add `skipped` to `QueueTicketStatus` domain type in a future iteration to preserve state fidelity. |
| "All 18 new test files are unit tests using mocks — not integration tests" | QA Architect | Accepted with documented caveat. Unit-level repository tests with Prisma mocks verify contract correctness (field mapping, enum conversions, filter logic) without a real DB. True integration tests (against a real Postgres instance with `prisma migrate dev`) are a Phase 3 CI task. These tests are the correct first layer for fast feedback loops. |
| "BeautyService domain entity (session) doesn't match BeautyAnnotation schema (treatment-pin)" | DDD Architect | Accepted with documented TODO. BeautyService is mapped to BeautyAnnotation via find-or-create BeautyRecord. patientId is reconstructed from the record relation on reads. TODO: Align `BeautyService` domain entity with the body-map schema (add coordinates, view, parameters) in Phase 3 UI. |
| "DentalChart.procedures don't map to DentalToothCondition granularity" | Schema Architect | Accepted. `odontogramState` JSONB stores the full chart snapshot (teeth + procedures). `DentalToothCondition` rows are written as an append-only audit trail per procedure. This gives fast full-chart reads (single JSONB fetch) + per-tooth condition history queries without dual-loading on every read. |
| "Analytics and Reporting repositories remain InMemory" | Architecture Review | Accepted. `MetricRepository`, `DashboardRepository`, `AnalyticsReportRepository`, `ReportRepository` are read-model projections computed from core tables. The correct implementation is a CQRS read-model projection layer (Phase 3). Forcing these into the same write-model tables would violate CQRS and create coupled, over-complex queries. |

---

## 7. RLS Policy Generation Reference

The following SQL must be applied after each migration via a post-migration script (`prisma/rls-policies.sql`):

```sql
-- Template: apply to all tenant-scoped tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'branches', 'users', 'patients', 'patient_addresses',
    'appointments', 'encounters', 'dental_records', 'dental_tooth_conditions',
    'beauty_records', 'beauty_annotations', 'inventory_items',
    'inventory_consumption_logs', 'queue_tickets', 'invoices',
    'invoice_line_items', 'invoice_payments', 'commission_rules',
    'commission_calculations', 'commission_line_items', 'loyalty_accounts',
    'loyalty_transactions', 'loyalty_rewards', 'clinic_subscriptions',
    'portal_accounts', 'caregiver_access_grants', 'notifications',
    'audit_entries', 'workflows', 'ai_models'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I; ' ||
      'CREATE POLICY tenant_isolation ON %I ' ||
      'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t, t
    );
  END LOOP;
END $$;

-- Super Admin bypass (applied to application role that Platform Admin uses)
-- GRANT BYPASSRLS ON ALL TABLES IN SCHEMA public TO saas_platform_admin_role;
```
