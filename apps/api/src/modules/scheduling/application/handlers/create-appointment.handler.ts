import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicalPricingUnit, AppointmentStatus as PrismaAppointmentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CreateAppointmentCommand } from '../commands/create-appointment.command';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER, PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentScheduledEvent } from '../../domain/events/appointment-scheduled.event';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { generateEntityId } from '../../../../common/id-generator.util';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { AnalyticsAggregationService } from '../../../../infrastructure/redis/services/analytics-aggregation.service';
import { advanceRecurrenceDate } from '../../domain/recurrence.util';
import { BookingConcurrencyService } from '../services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../services/appointment-snapshot.service';
import { BookingCommercialResolver } from '../services/booking-commercial-resolver.service';
import { ProviderEligibilityService } from '../services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../services/service-resource-requirement.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isTenantCanonicalWriteEnabled } from '../../../clinical-catalog/domain/feature-flag.helpers';
import { isBookingEligibilityEnforcementEnabled } from '../../domain/booking-feature-flags';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';

@Injectable()
export class CreateAppointmentHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
    private readonly analytics: AnalyticsAggregationService,
    private readonly concurrency: BookingConcurrencyService,
    private readonly snapshots: AppointmentSnapshotService,
    private readonly commercial: BookingCommercialResolver,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async execute(cmd: CreateAppointmentCommand) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenant context could not be resolved');
    }
    if (!cmd.patientId?.trim()) {
      throw new BadRequestException('patientId is required');
    }
    if (!cmd.providerId?.trim()) {
      throw new BadRequestException('providerId is required');
    }
    if (!cmd.actorId?.trim()) {
      throw new BadRequestException('actorId is required from authenticated context');
    }
    const actorId = cmd.actorId.trim();

    const patient = await this.patientRepository.findById(cmd.patientId, tenantId);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const features = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenantId }, select: { features: true } }),
    );
    const featuresJson = (features?.features as Record<string, unknown> | null) ?? null;
    const canonicalWriteOn = isTenantCanonicalWriteEnabled(featuresJson);
    const eligibilityOn = isBookingEligibilityEnforcementEnabled(featuresJson);
    if (canonicalWriteOn && !cmd.clinicalServiceId?.trim() && !cmd.serviceType?.trim()) {
      throw new BadRequestException('clinicalServiceId is required when catalog.canonical.write is ON');
    }
    if (canonicalWriteOn && !cmd.clinicalServiceId?.trim() && cmd.serviceType?.trim()) {
      throw new BadRequestException('Free-text serviceType booking forbidden when catalog.canonical.write is ON');
    }
    // Eligibility enforcement is independent of catalog.canonical.write.
    if (eligibilityOn && !cmd.clinicalServiceId?.trim()) {
      throw new BadRequestException(
        'clinicalServiceId is required when booking.eligibility.enforcement is ON',
      );
    }

    const occurrenceCount = cmd.recurrence
      ? Math.min(Math.max(cmd.recurrence.occurrences, 2), 52)
      : 1;
    const seriesId = occurrenceCount > 1 ? generateEntityId('recurrence') : null;
    const createdIds: string[] = [];

    let slotStart = new Date(cmd.start);
    let slotEnd = new Date(cmd.end);
    const durationMs = slotEnd.getTime() - slotStart.getTime();
    const branchId = tenant.branchId ?? null;
    const resourceIds = [
      ...new Set(
        [...(cmd.resourceIds ?? []), ...(cmd.resourceId ? [cmd.resourceId] : [])].filter(Boolean),
      ),
    ] as string[];

    let resolvedCommercial =
      cmd.clinicalServiceId?.trim()
        ? await this.commercial.resolveCanonical({
            tenantId,
            actorId,
            clinicalServiceId: cmd.clinicalServiceId.trim(),
            branchId,
            pricingUnit: cmd.pricingUnit ?? ClinicalPricingUnit.PER_VISIT,
            currency: cmd.currency ?? 'SYP',
            quantity: cmd.quantity ?? 1,
            commercialReason: cmd.commercialReason ?? null,
          })
        : null;

    if (cmd.clinicalServiceId?.trim()) {
      await this.eligibility.assertClinicalServiceAccessible(
        tenantId,
        cmd.clinicalServiceId.trim(),
      );
    }

    for (let i = 0; i < occurrenceCount; i += 1) {
      await this.enforcement.enforceAppointmentLimit(tenantId);

      const startIso = slotStart.toISOString();
      const endIso = slotEnd.toISOString();
      const appointmentId = randomUUID();

      await this.concurrency.withBookingTransaction(async (client) => {
        await this.concurrency.assertSlotAvailableUnderLock(client, {
          tenantId,
          providerId: cmd.providerId,
          resourceIds,
          start: slotStart,
          end: slotEnd,
        });

        if (cmd.clinicalServiceId?.trim()) {
          await this.eligibility.assertEligible({
            tenantId,
            providerUserId: cmd.providerId,
            clinicalServiceId: cmd.clinicalServiceId.trim(),
            branchId,
            at: slotStart,
            client,
          });
          await this.resources.assertRequirementsSatisfied({
            tenantId,
            clinicalServiceId: cmd.clinicalServiceId.trim(),
            branchId,
            allocatedResourceIds: resourceIds,
            client,
          });
        } else if (resourceIds.length > 0) {
          await this.resources.assertAllocatedResourcesOwned({
            tenantId,
            branchId,
            allocatedResourceIds: resourceIds,
            client,
          });
        }

        await client.appointment.create({
          data: {
            id: appointmentId,
            tenantId,
            branchId,
            patientId: cmd.patientId,
            providerId: cmd.providerId,
            scheduledStart: slotStart,
            scheduledEnd: slotEnd,
            status: PrismaAppointmentStatus.PENDING,
            notes: cmd.notes ?? null,
            serviceType: cmd.serviceType ?? null,
            clinicalServiceId: cmd.clinicalServiceId?.trim() || null,
            isEmergency: cmd.isEmergency ?? false,
            recurrenceSeriesId: seriesId,
            resourceId: resourceIds[0] ?? null,
            // Provenance: CANONICAL_REQUIRED only when flag ON + revision 1 written atomically.
            snapshotWriteMode:
              canonicalWriteOn && resolvedCommercial ? 'CANONICAL_REQUIRED' : 'LEGACY',
          },
        });

        await this.concurrency.replaceResourceAllocations(client, {
          tenantId,
          appointmentId,
          resourceIds,
        });

        if (canonicalWriteOn && resolvedCommercial) {
          const revision = await this.snapshots.captureCanonicalRevision1(client, {
            tenantId,
            appointmentId,
            actorId,
            commercial: resolvedCommercial,
          });
          await this.auditLog.recordInTransaction(client, {
            tenantId,
            action: 'scheduling.snapshot.revision1',
            resourceId: revision.id,
            actorId,
            actorRoles: [],
            descriptionEn: 'Appointment commercial snapshot revision 1 captured',
            descriptionAr: 'تم التقاط مراجعة اللقطة التجارية الأولى للموعد',
            details: { appointmentId, clinicalServiceId: resolvedCommercial.clinicalServiceId },
          });
        }

        // Bind portal idempotency COMPLETE into the same booking transaction (WB-PA-03 crash window).
        if (cmd.portalIdempotencyComplete && i === 0) {
          const result = cmd.portalIdempotencyComplete.buildResult(appointmentId);
          const updated = await client.portalSchedulingIdempotencyLedger.updateMany({
            where: {
              id: cmd.portalIdempotencyComplete.rowId,
              ownerToken: cmd.portalIdempotencyComplete.ownerToken,
              status: 'IN_PROGRESS',
            },
            data: {
              fingerprint: cmd.portalIdempotencyComplete.fingerprint,
              status: 'COMPLETED',
              responseJson: result as never,
              completedAt: new Date(),
              updatedAt: new Date(),
            },
          });
          if (updated.count !== 1) {
            throw new BadRequestException(
              'Portal idempotency ownership lost during booking commit',
            );
          }
        }
      });

      createdIds.push(appointmentId);
      await this.eventPublisher.publish(
        new AppointmentScheduledEvent(
          tenantId,
          branchId,
          appointmentId,
          cmd.patientId,
          cmd.providerId,
          startIso,
          endIso,
        ),
      );
      this.analytics.incrementAppointments(tenantId).catch(() => undefined);

      if (cmd.recurrence && i < occurrenceCount - 1) {
        slotStart = advanceRecurrenceDate(slotStart, cmd.recurrence.frequency);
        slotEnd = new Date(slotStart.getTime() + durationMs);
      }
    }

    return {
      appointmentId: createdIds[0],
      appointmentIds: createdIds,
      seriesId,
    };
  }
}
