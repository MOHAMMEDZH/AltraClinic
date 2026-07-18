# Production Database Migration Workflow

## Current state (remediated)

- **Development:** `npm run db:push` remains for fast local iteration.
- **Production:** use versioned Prisma migrations via `npm run db:migrate:deploy`.
- **Post-deploy SQL:** RLS policies and audit triggers applied manually or via CI step.

## Commands

```bash
cd apps/api

# Create migration from schema changes (development)
npm run db:migrate:dev -- --name describe_change

# Apply pending migrations (production / CI)
npm run db:migrate:deploy

# Apply RLS policies after migrate
npm run db:rls:apply

# Apply audit triggers
npm run db:triggers:apply
```

## Baseline strategy

1. Run `prisma migrate diff` against production schema to produce initial baseline.
2. Mark baseline as applied: `prisma migrate resolve --applied <baseline_name>`.
3. Reconcile legacy `db/migrations/*.sql` — fold into Prisma migrations or document one-time apply order.

## Rollback

- Prisma does not auto-rollback. Maintain down migrations for critical changes.
- Prefer forward-fix migrations over destructive rollback in production.
- Test every migration on a staging clone before production deploy.

## Verification checklist

- [ ] `prisma migrate status` shows no pending migrations
- [ ] RLS script applied (`app.current_tenant_id` policies active)
- [ ] Seed smoke test passes on migrated database
- [ ] Application boots and tenant-scoped API returns data

See also: `docs/DISASTER_RECOVERY.md`, `docs/MIGRATION_STRATEGY.md`.
