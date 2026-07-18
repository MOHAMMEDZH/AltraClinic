# Migration Strategy

**Project:** Scalable Multi-Tenant B2B SaaS EMR & ERP  
**Schema Version:** 2026-06-15.v1  
**Target Engine:** PostgreSQL 16+  
**ORM:** Prisma 5.x

---

## 1. Prerequisites

Install Prisma and the PostgreSQL client in the API package:

```bash
cd apps/api
npm install @prisma/client prisma
npm install -D prisma
```

Add the `DATABASE_URL` environment variable (connection string):

```env
# apps/api/.env
DATABASE_URL="postgresql://app_user:password@localhost:5432/saas_emr?schema=public"
```

Create the PostgreSQL role structure before running migrations:

```sql
-- Run as superuser once
CREATE ROLE app_user LOGIN PASSWORD 'password';
CREATE ROLE saas_platform_admin_role NOLOGIN BYPASSRLS;
GRANT saas_platform_admin_role TO app_user;
CREATE DATABASE saas_emr OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE saas_emr TO app_user;
```

---

## 2. Migration Phases

### Phase 1 — Foundation (Run Now)

**Goal:** Establish tenancy, identity, and core clinical tables. Unblocks authentication and patient registration.

**Tables created:**
- `tenants`, `branches`
- `users`, `user_role_assignments`, `refresh_tokens`
- `patients`, `patient_addresses`
- `appointments`
- `encounters`
- `queue_tickets`
- `outbox_events`
- `audit_entries`

**Command:**

```bash
cd apps/api
npx prisma migrate dev --name "phase-1-foundation"
```

**Post-migration scripts** (run after `migrate dev`):

```bash
npx prisma db execute --file prisma/rls-policies.sql
npx prisma db execute --file prisma/triggers.sql
```

---

### Phase 2 — Clinical Specialisations

**Goal:** Dental and beauty EMR modules.

**Tables created:**
- `dental_records`, `dental_tooth_conditions`
- `beauty_records`, `beauty_annotations`

```bash
npx prisma migrate dev --name "phase-2-clinical-specialisations"
```

---

### Phase 3 — Financial Suite

**Goal:** Billing, commissions, inventory.

**Tables created:**
- `invoices`, `invoice_line_items`, `invoice_payments`
- `commission_rules`, `commission_calculations`, `commission_line_items`
- `inventory_items`, `inventory_consumption_logs`

```bash
npx prisma migrate dev --name "phase-3-financial-suite"
```

---

### Phase 4 — Loyalty, Subscriptions & Portal

**Goal:** Patient engagement and clinic subscription packages.

**Tables created:**
- `loyalty_accounts`, `loyalty_transactions`, `loyalty_rewards`
- `clinic_subscriptions`
- `portal_accounts`, `caregiver_access_grants`
- `notifications`

```bash
npx prisma migrate dev --name "phase-4-loyalty-subscriptions-portal"
```

---

### Phase 5 — Platform Admin & SaaS Billing

**Goal:** Super Admin control-plane and dunning engine tables.

**Tables created:**
- `platform_tenants`
- `privileged_access_grants`
- `platform_subscriptions`

```bash
npx prisma migrate dev --name "phase-5-platform-admin"
```

---

### Phase 6 — Operations & AI

**Goal:** Workflow engine and AI model registry.

**Tables created:**
- `workflows`
- `ai_models`

```bash
npx prisma migrate dev --name "phase-6-operations-ai"
```

---

## 3. Post-Migration SQL Scripts

### `prisma/rls-policies.sql` — Row-Level Security

```sql
DO $$
DECLARE
  t TEXT;
  tenant_scoped_tables TEXT[] := ARRAY[
    'branches', 'users', 'patients', 'patient_addresses',
    'appointments', 'encounters', 'dental_records', 'dental_tooth_conditions',
    'beauty_records', 'beauty_annotations', 'inventory_items',
    'inventory_consumption_logs', 'queue_tickets', 'invoices',
    'invoice_line_items', 'invoice_payments', 'commission_rules',
    'commission_calculations', 'commission_line_items', 'loyalty_accounts',
    'loyalty_transactions', 'loyalty_rewards', 'clinic_subscriptions',
    'portal_accounts', 'caregiver_access_grants', 'notifications',
    'audit_entries', 'workflows', 'ai_models', 'user_role_assignments',
    'refresh_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I; '
      'CREATE POLICY tenant_isolation ON %I '
      'USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t, t
    );
  END LOOP;
END $$;
```

### `prisma/triggers.sql` — Audit Immutability

```sql
-- Prevent any UPDATE or DELETE on audit_entries
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'audit_entries is append-only. Operation % is forbidden.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries;
CREATE TRIGGER audit_entries_immutable
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Auto-update updated_at timestamp (Prisma handles this in app layer,
-- but this trigger is a defence-in-depth for direct DB writes)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

---

## 4. Prisma Client Setup — Middleware

Create `apps/api/src/infrastructure/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });

    // Soft delete middleware: automatically filter deleted rows
    this.$use(async (params, next) => {
      const softDeleteModels = [
        'Tenant', 'Branch', 'User', 'Patient', 'Appointment',
        'Encounter', 'InventoryItem', 'Invoice', 'CommissionRule',
        'LoyaltyReward', 'ClinicSubscription',
      ];

      if (softDeleteModels.includes(params.model ?? '')) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args.where = { ...params.args.where, deletedAt: null };
        }
        if (params.action === 'findMany') {
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Execute a callback within a tenant-scoped transaction.
   * Sets `app.current_tenant_id` for RLS enforcement.
   */
  async withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`
      );
      return fn();
    });
  }
}
```

---

## 5. Production Deployment Strategy

### 5.1 Blue/Green Migration (Zero Downtime)

For each migration in production:

1. **Apply migration in shadow mode** — Prisma validates against shadow DB
2. **Run `prisma migrate deploy`** — applies only pending migrations (never interactive)
3. **RLS and trigger scripts** — run post-migration SQL scripts
4. **Smoke test** — run `prisma db execute --file prisma/smoke-check.sql`

```bash
# Production deploy command (CI/CD pipeline)
npx prisma migrate deploy
npx prisma db execute --file prisma/rls-policies.sql
npx prisma db execute --file prisma/triggers.sql
```

### 5.2 Backward-Compatible Migration Rules

All schema changes must follow these rules to avoid downtime:

| Operation | Safe? | Note |
|---|---|---|
| Add nullable column | ✅ Safe | No data migration needed |
| Add table | ✅ Safe | — |
| Add index | ✅ Safe (concurrent) | Use `CREATE INDEX CONCURRENTLY` in raw SQL |
| Rename column | ❌ Breaking | Add new column → backfill → drop old column (3 migrations) |
| Change column type | ❌ Breaking | New column → backfill → drop old column |
| Drop column | ❌ Breaking | Deploy app without reference first, then drop |
| Add NOT NULL column | ❌ Breaking | Add nullable → backfill → add constraint |

### 5.3 Adding Indexes in Production

Never use Prisma's `@@index` on a large live table — it takes a table lock. Instead, add a raw migration:

```sql
-- In a new Prisma migration file (edit the generated SQL)
CREATE INDEX CONCURRENTLY idx_encounters_tenant_patient
  ON encounters (tenant_id, patient_id)
  WHERE deleted_at IS NULL;
```

---

## 6. Table Partitioning Roadmap (Production Scale)

The following tables will require partitioning when row counts exceed thresholds:

| Table | Partition Strategy | Trigger |
|---|---|---|
| `audit_entries` | RANGE on `created_at` (monthly) | > 50M rows |
| `notifications` | RANGE on `created_at` (monthly) | > 20M rows |
| `loyalty_transactions` | RANGE on `created_at` (quarterly) | > 10M rows |
| `outbox_events` | RANGE on `created_at` (weekly) + auto-archive processed | > 1M rows |
| `inventory_consumption_logs` | RANGE on `consumed_at` (monthly) | > 5M rows |

**Implementation:** Prisma does not natively support partitioned tables. Use raw SQL migrations to convert tables to partitioned when thresholds are hit.

---

## 7. Seed Data

Create `apps/api/prisma/seed.ts` for development:

```typescript
import { PrismaClient, EntitlementPlan, PlatformRegion } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // 1. Create a development tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: randomUUID(),
      name: 'Damascus Dental Clinic',
      slug: 'damascus-dental',
      locale: 'ar-SY',
      timezone: 'Asia/Damascus',
      lifecycleStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 2. Register tenant in platform admin
  await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: tenant.name,
      region: PlatformRegion.ME_SOUTH,
      plan: EntitlementPlan.LITE,
      provisionedBy: 'system-seed',
      trialEndsAt: tenant.trialEndsAt,
    },
  });

  // 3. Create owner user
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'owner@damascus-dental.local',
      passwordHash: '$2b$12$PLACEHOLDER_HASH', // replace with bcryptjs hash
      firstName: 'Ahmad',
      lastName: 'Al-Khatib',
      roles: {
        create: [{ role: 'OWNER' }],
      },
    },
  });

  console.log('Seed complete:', { tenantId: tenant.id, ownerId: owner.id });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `apps/api/package.json`:
```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run seed:
```bash
npx prisma db seed
```

---

## 8. Next Steps After Phase 1 Migration

Once `phase-1-foundation` migration is applied and RLS is active:

1. **Replace `InMemoryUserRepository`** with `PrismaUserRepository` implementing `UserRepository` interface — wire `{ provide: USER_REPOSITORY, useClass: PrismaUserRepository }` in `IdentityModule`
2. **Replace `InMemoryPatientRepository`** with `PrismaPatientRepository`
3. **Add JWT authentication** — `@nestjs/jwt` + `@nestjs/passport` with `JwtAuthGuard` populating `req.user.tenantId`
4. **Wire `PrismaService.withTenantContext()`** into `TenantContextService` to set `app.current_tenant_id` before every query
5. Repeat repository swap for all modules in dependency order: Scheduling → EMR → Billing → Queue → Commission → Loyalty → Subscription → PlatformAdmin → Portal
