# Wave G Migration Validation

**Evidence SHA:** `22b3b5d`  
**Local:** `npx prisma migrate deploy` against `booking_test` @ `localhost:5433` → **No pending migrations** (63 found; Wave G three already applied).

## Migrations

| Order | Folder | Tables / enums |
|-------|--------|----------------|
| 1 | `20260907230000_phase48_wave_g1_availability_exception` | enum `availability_exception_type`; table `availability_exceptions` |
| 2 | `20260907233000_phase48_wave_g2_waitlist_offer` | table `waitlist_offers` (+ offer status enum as defined in SQL) |
| 3 | `20260907234500_phase48_wave_g3_recall_sor` | tables `recall_rules`, `patient_recall_instances` |

## RLS notes

All Wave G tables:

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- Policies: `tenant_select` / `tenant_insert` / `tenant_update` / `tenant_delete` (tenant_id = `app.current_tenant_id` pattern, consistent with prior waves)

Postgres packs assert cross-tenant deny via `booking_app` role:

- G1-PG-03, G2-PG-04, G3-PG-03 — **PASS** @ `22b3b5d`

## Soft delete

- Exceptions / rules use soft-delete (`deletedAt`); active reads exclude deleted (covered by G1-PG-04, G3-PG-04).

## Non-destructive

- No remap of prior waitlist CRUD rows beyond additive offer SoR.  
- Legacy `WaitlistSlotNotificationService` retained unused by cancel listener (CTO KEEP).  
- G4: zero schema change.
