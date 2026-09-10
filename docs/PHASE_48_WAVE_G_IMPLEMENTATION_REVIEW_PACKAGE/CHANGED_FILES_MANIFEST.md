# Wave G Changed Files Manifest

**Range:** `7b14a02^..22b3b5d` (G1 through G4 inclusive)  
**Command:** `git diff --name-status 7b14a02^..22b3b5d`

## Product — API / schema

| Status | Path |
|--------|------|
| A | `apps/api/prisma/migrations/20260907230000_phase48_wave_g1_availability_exception/migration.sql` |
| A | `apps/api/prisma/migrations/20260907233000_phase48_wave_g2_waitlist_offer/migration.sql` |
| A | `apps/api/prisma/migrations/20260907234500_phase48_wave_g3_recall_sor/migration.sql` |
| M | `apps/api/prisma/schema.prisma` |
| A | `apps/api/src/modules/scheduling/application/handlers/availability-exception.handlers.ts` |
| A | `apps/api/src/modules/scheduling/application/handlers/recall.handlers.ts` |
| A | `apps/api/src/modules/scheduling/application/handlers/waitlist-offer.handlers.ts` |
| M | `apps/api/src/modules/scheduling/application/handlers/scheduling-resources.handlers.ts` |
| M | `apps/api/src/modules/scheduling/application/handlers/scheduling-support.handlers.ts` |
| M | `apps/api/src/modules/scheduling/application/integrations/appointment-cancelled-waitlist.listener.ts` |
| A | `apps/api/src/modules/scheduling/application/services/availability-exception-query.service.ts` |
| A | `apps/api/src/modules/scheduling/application/services/availability-slot-builder.ts` |
| A | `apps/api/src/modules/scheduling/application/services/waitlist-offer-autofill.service.ts` |
| A | `apps/api/src/modules/scheduling/controllers/recall.controller.ts` |
| M | `apps/api/src/modules/scheduling/controllers/schedule-settings.controller.ts` |
| M | `apps/api/src/modules/scheduling/controllers/waitlist.controller.ts` |
| A | `apps/api/src/modules/scheduling/domain/availability-exception-evaluator.ts` |
| A | `apps/api/src/modules/scheduling/domain/recall.lifecycle.ts` |
| A | `apps/api/src/modules/scheduling/domain/waitlist-offer.lifecycle.ts` |
| M | `apps/api/src/modules/scheduling/domain/booking-feature-flags.ts` |
| M | `apps/api/src/modules/scheduling/scheduling.module.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g1-availability-exception.unit.spec.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g1-availability-exception.postgres.integration.spec.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g2-waitlist-offer.unit.spec.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g2-waitlist-offer.postgres.integration.spec.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g3-recall.unit.spec.ts` |
| A | `apps/api/src/modules/scheduling/tests/wave-g3-recall.postgres.integration.spec.ts` |

## Product — clinic-dashboard (G4)

| Status | Path |
|--------|------|
| M | `apps/clinic-dashboard/src/features/scheduling/AppointmentsPage.tsx` |
| M | `apps/clinic-dashboard/src/features/scheduling/api/scheduling-api.ts` |
| A | `apps/clinic-dashboard/src/features/scheduling/components/AvailabilityExceptionsPanel.tsx` |
| A | `apps/clinic-dashboard/src/features/scheduling/components/RecallPanel.tsx` |
| M | `apps/clinic-dashboard/src/features/scheduling/components/WaitlistPanel.tsx` |
| M | `apps/clinic-dashboard/src/features/scheduling/config/scheduling-config.ts` |
| M | `apps/clinic-dashboard/src/features/scheduling/config/scheduling-config.test.ts` |
| M | `apps/clinic-dashboard/src/features/scheduling/hooks/useScheduling.ts` |
| M | `apps/clinic-dashboard/src/features/scheduling/types/scheduling.types.ts` |
| M | `apps/clinic-dashboard/src/i18n/scheduling-messages.ts` |

## Kickoff docs (present on branch range)

| Status | Path |
|--------|------|
| A | `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/README.md` |
| A | `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/WAVE_G_ACCEPTANCE_CRITERIA.md` |
| A | `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/WAVE_G_CURRENT_STATE_VS_EXIT.md` |
| A | `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/WAVE_G_FROZEN_SCOPE_EXTRACT.md` |
| A | `docs/PHASE_48_WAVE_G_KICKOFF_PACKAGE/WAVE_G_IMPLEMENTATION_SLICES.md` |

## Explicitly excluded from product commits

- `apps/api/.ci-evidence/**` (local only)
- This Implementation Review Package folder (G5; uncommitted until CTO authorizes)
