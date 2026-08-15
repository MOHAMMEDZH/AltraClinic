import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ClinicalPricingUnit } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueBoardService } from '../services/queue-board.service';
import { QueueNotificationService } from '../services/queue-notification.service';
import type { QueuePriority } from '../../domain/queue.types';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { BookingConcurrencyService } from '../../../scheduling/application/services/booking-concurrency.service';
import { AppointmentSnapshotService } from '../../../scheduling/application/services/appointment-snapshot.service';
import { BookingCommercialResolver } from '../../../scheduling/application/services/booking-commercial-resolver.service';
import { ProviderEligibilityService } from '../../../scheduling/application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../../../scheduling/application/services/service-resource-requirement.service';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../../../scheduling/application/ports/scheduling-audit-log.port';
import { isTenantCanonicalWriteEnabled } from '../../../clinical-catalog/domain/feature-flag.helpers';
import { isBookingEligibilityEnforcementEnabled } from '../../../scheduling/domain/booking-feature-flags';

export class WalkInQueueDTO {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Required when catalog.canonical.write is ON — Wave B booking provenance. */
  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  /** Optional allocated scheduling resources (canonical requirements). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  resourceIds?: string[];

  /** Bounded legacy single-primary resource mirror. */
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsIn(['normal', 'appointment', 'walk_in', 'priority', 'vip', 'emergency'])
  priority?: QueuePriority;
}

@Injectable()
export class WalkInQueueHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly notifications: QueueNotificationService,
    private readonly concurrency: BookingConcurrencyService,
    private readonly snapshots: AppointmentSnapshotService,
    private readonly commercial: BookingCommercialResolver,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async execute(input: WalkInQueueDTO, authenticatedActorId: string) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException(
        'authenticatedActorId is required for queue walk-in',
      );
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();
    const branchId = input.branchId?.trim() || tenant.branchId || null;
    const providerId = input.providerId.trim();

    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, tenantId: tenant.tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const features = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenant.tenantId }, select: { features: true } }),
    );
    const featuresJson = (features?.features as Record<string, unknown> | null) ?? null;
    const canonicalWriteOn = isTenantCanonicalWriteEnabled(featuresJson);
    const eligibilityOn = isBookingEligibilityEnforcementEnabled(featuresJson);

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);
    const prismaPriority = (input.priority ?? 'walk_in').toUpperCase().replace('-', '_');
    const appointmentId = randomUUID();
    const resourceIds = [
      ...new Set(
        [...(input.resourceIds ?? []), ...(input.resourceId ? [input.resourceId] : [])].filter(
          Boolean,
        ) as string[],
      ),
    ];

    const clinicalServiceId = input.clinicalServiceId?.trim() || null;

    // Eligibility enforcement is independent of catalog.canonical.write.
    if (eligibilityOn && !clinicalServiceId) {
      throw new BadRequestException(
        'clinicalServiceId is required for queue walk-in when booking.eligibility.enforcement is ON',
      );
    }

    let resolvedCommercial = null as Awaited<
      ReturnType<BookingCommercialResolver['resolveCanonical']>
    > | null;

    if (canonicalWriteOn) {
      if (!clinicalServiceId) {
        throw new BadRequestException(
          'clinicalServiceId is required for queue walk-in when catalog.canonical.write is ON',
        );
      }
      resolvedCommercial = await this.commercial.resolveCanonical({
        tenantId: tenant.tenantId,
        actorId,
        clinicalServiceId,
        branchId,
        pricingUnit: ClinicalPricingUnit.PER_VISIT,
        currency: 'SYP',
        quantity: 1,
        commercialReason: 'QUEUE_WALK_IN',
      });
    }

    const ticket = await this.concurrency.withBookingTransaction(async (client) => {
      await this.concurrency.assertSlotAvailableUnderLock(client, {
        tenantId: tenant.tenantId,
        providerId,
        resourceIds,
        start: now,
        end,
      });

      if (clinicalServiceId) {
        await this.eligibility.assertClinicalServiceAccessible(
          tenant.tenantId,
          clinicalServiceId,
          client,
        );
        // assertEligible is a no-op when eligibility flag OFF.
        await this.eligibility.assertEligible({
          tenantId: tenant.tenantId,
          providerUserId: providerId,
          clinicalServiceId,
          branchId,
          at: now,
          client,
        });
        await this.resources.assertRequirementsSatisfied({
          tenantId: tenant.tenantId,
          clinicalServiceId,
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      } else if (resourceIds.length > 0) {
        await this.resources.assertAllocatedResourcesOwned({
          tenantId: tenant.tenantId,
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      }

      // CHECKED_IN is confirmed-or-beyond → commercialLockedAt must be set atomically.
      const commercialLockedAt = now;

      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId: tenant.tenantId,
          branchId,
          patientId: input.patientId,
          providerId,
          scheduledStart: now,
          scheduledEnd: end,
          status: 'CHECKED_IN',
          serviceType: 'walk_in',
          notes: 'Walk-in queue entry',
          clinicalServiceId,
          resourceId: resourceIds[0] ?? null,
          commercialLockedAt,
          snapshotWriteMode:
            canonicalWriteOn && resolvedCommercial ? 'CANONICAL_REQUIRED' : 'LEGACY',
        },
      });

      await this.concurrency.replaceResourceAllocations(client, {
        tenantId: tenant.tenantId,
        appointmentId,
        resourceIds,
      });

      if (canonicalWriteOn && resolvedCommercial) {
        const revision = await this.snapshots.captureCanonicalRevision1(client, {
          tenantId: tenant.tenantId,
          appointmentId,
          actorId,
          commercial: resolvedCommercial,
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId: tenant.tenantId,
          action: 'scheduling.snapshot.revision1',
          resourceId: revision.id,
          actorId,
          actorRoles: [],
          descriptionEn: 'Queue walk-in commercial snapshot revision 1 captured',
          descriptionAr: 'تم التقاط مراجعة اللقطة التجارية الأولى لدخول قائمة الانتظار',
          details: {
            appointmentId,
            clinicalServiceId: resolvedCommercial.clinicalServiceId,
            providerId,
          },
        });
      }

      return client.queueTicket.create({
        data: {
          tenantId: tenant.tenantId,
          branchId,
          appointmentId,
          patientId: input.patientId,
          providerId,
          scheduledStart: now,
          scheduledEnd: end,
          status: 'WAITING',
          priority: prismaPriority as 'WALK_IN',
          checkedInAt: now,
          sortOrder: 999,
          resourceId: resourceIds[0] ?? null,
        },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
    });

    const avgWait = await this.board.getMetrics(tenant.tenantId, branchId);
    const position = await this.board.getWaitingPosition(tenant.tenantId, ticket as never);
    const item = this.board.toBoardItem(ticket as never, position, avgWait.avgWaitMinutes);

    await this.notifications.notifyCheckIn(item);
    await this.broadcast.publish({
      eventId: `queue-walkin-${ticket.id}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId,
      channel: 'queue',
      type: 'queue.walk_in',
      payload: item as unknown as Record<string, unknown>,
    });

    return item;
  }
}
