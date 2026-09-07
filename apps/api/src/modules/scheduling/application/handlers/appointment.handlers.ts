import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus as PrismaAppointmentStatus, ClinicalPricingUnit, Prisma } from '@prisma/client';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { AppointmentStatus } from '../../domain/appointment-status.enum';
import { TimeSlotVO } from '../../domain/timeslot.vo';
import { AppointmentCancelledEvent } from '../../domain/events/appointment-cancelled.event';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { BookingConcurrencyService } from '../services/booking-concurrency.service';
import { ProviderEligibilityService } from '../services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../services/service-resource-requirement.service';
import { AppointmentSnapshotService } from '../services/appointment-snapshot.service';
import { BookingCommercialResolver } from '../services/booking-commercial-resolver.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { assertCourseIntervalsForReschedule } from '../../../aesthetic/services/wave-e-reference.validation';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';

const DOMAIN_TO_PRISMA: Record<AppointmentStatus, PrismaAppointmentStatus> = {
  [AppointmentStatus.Pending]: PrismaAppointmentStatus.PENDING,
  [AppointmentStatus.Confirmed]: PrismaAppointmentStatus.CONFIRMED,
  [AppointmentStatus.CheckedIn]: PrismaAppointmentStatus.CHECKED_IN,
  [AppointmentStatus.InProgress]: PrismaAppointmentStatus.IN_PROGRESS,
  [AppointmentStatus.Cancelled]: PrismaAppointmentStatus.CANCELLED,
  [AppointmentStatus.Completed]: PrismaAppointmentStatus.COMPLETED,
  [AppointmentStatus.NoShow]: PrismaAppointmentStatus.NO_SHOW,
};

function prismaAppointmentStatusToDomain(status: string): AppointmentStatus {
  switch (String(status).toUpperCase()) {
    case 'CONFIRMED':
      return AppointmentStatus.Confirmed;
    case 'CHECKED_IN':
      return AppointmentStatus.CheckedIn;
    case 'IN_PROGRESS':
      return AppointmentStatus.InProgress;
    case 'CANCELLED':
      return AppointmentStatus.Cancelled;
    case 'COMPLETED':
      return AppointmentStatus.Completed;
    case 'NO_SHOW':
      return AppointmentStatus.NoShow;
    default:
      return AppointmentStatus.Pending;
  }
}

function applyStatusAction(
  current: AppointmentStatus,
  action: UpdateAppointmentInput['action'],
  cancellationReason?: string | null,
): { status: AppointmentStatus; cancellationReason?: string | null } {
  if (!action) return { status: current };
  switch (action) {
    case 'confirm':
      return { status: AppointmentStatus.Confirmed };
    case 'cancel':
      return {
        status: AppointmentStatus.Cancelled,
        cancellationReason: cancellationReason?.trim() || null,
      };
    case 'complete':
      return { status: AppointmentStatus.Completed };
    case 'no_show':
      return { status: AppointmentStatus.NoShow };
    case 'check_in':
      if (
        current === AppointmentStatus.Cancelled ||
        current === AppointmentStatus.Completed ||
        current === AppointmentStatus.NoShow
      ) {
        return { status: current };
      }
      return { status: AppointmentStatus.CheckedIn };
    case 'start_visit':
      if (
        current === AppointmentStatus.Cancelled ||
        current === AppointmentStatus.Completed ||
        current === AppointmentStatus.NoShow
      ) {
        return { status: current };
      }
      return { status: AppointmentStatus.InProgress };
    default:
      return { status: current };
  }
}

export type UpdateAppointmentInput = {
  action?: 'confirm' | 'cancel' | 'complete' | 'no_show' | 'check_in' | 'start_visit';
  start?: string;
  end?: string;
  notes?: string | null;
  cancellationReason?: string | null;
  providerId?: string;
  serviceType?: string | null;
  isEmergency?: boolean;
  resourceId?: string | null;
  seriesScope?: 'future';
  clinicalServiceId?: string | null;
  changeReason?: string;
  commercialReason?: string;
  quantity?: number;
  pricingUnit?: string;
  currency?: string;
  resourceIds?: string[];
};

@Injectable()
export class ListAppointmentsHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    q?: string;
    providerId?: string;
    patientId?: string;
    branchId?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    return this.repo.list({
      tenantId: tenant.tenantId,
      branchId: query.branchId ?? tenant.branchId,
      providerId: query.providerId,
      patientId: query.patientId,
      status: query.status,
      from: query.from,
      to: query.to,
      q: query.q,
      limit,
      offset,
    });
  }
}

@Injectable()
export class UpdateAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly concurrency: BookingConcurrencyService,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    private readonly snapshots: AppointmentSnapshotService,
    private readonly commercial: BookingCommercialResolver,
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async execute(id: string, input: UpdateAppointmentInput, authenticatedActorId: string) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException('authenticatedActorId is required');
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();
    const appointment = await this.repo.findById(id, tenant.tenantId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    const row = await this.prisma.withPlatformBypass((c) =>
      c.appointment.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
        include: { effectiveSnapshotRevision: true },
      }),
    );
    if (!row) throw new NotFoundException('Appointment not found');

    const wasCancelled = input.action === 'cancel';
    const seriesId = appointment.recurrenceSeriesId;
    const branchId = appointment.branchId ?? tenant.branchId ?? null;
    const snap = row.effectiveSnapshotRevision;

    const requestedProviderId = input.providerId ?? appointment.providerId;
    const existingAllocations = await this.prisma.withPlatformBypass((c) =>
      c.appointmentResourceAllocation.findMany({
        where: { appointmentId: id },
        select: { schedulingResourceId: true },
      }),
    );
    const nextResourceId =
      input.resourceId !== undefined ? input.resourceId : appointment.resourceId;
    let uniqueResourceIds: string[];
    if (input.resourceIds !== undefined) {
      uniqueResourceIds = [
        ...new Set(
          [...input.resourceIds, ...(input.resourceId ? [input.resourceId] : [])].filter(
            Boolean,
          ) as string[],
        ),
      ];
    } else if (input.resourceId !== undefined) {
      uniqueResourceIds = nextResourceId ? [nextResourceId] : [];
    } else {
      uniqueResourceIds = [
        ...new Set([
          ...existingAllocations.map((a) => a.schedulingResourceId),
          ...(appointment.resourceId ? [appointment.resourceId] : []),
        ]),
      ];
    }

    const resourceIdsExplicitChange = input.resourceIds !== undefined;
    const slotAffecting =
      Boolean(input.start && input.end) ||
      (Boolean(input.providerId) && input.providerId !== appointment.providerId) ||
      (input.resourceId !== undefined && input.resourceId !== appointment.resourceId) ||
      resourceIdsExplicitChange;

    const commercialChange = this.isCommercialFieldChange(input, row, appointment, snap);
    const commercialLocked = this.snapshots.isCommercialLocked({
      status: row.status,
      commercialLockedAt: (row as { commercialLockedAt?: Date | null }).commercialLockedAt ?? null,
      effectiveSnapshotRevisionId: row.effectiveSnapshotRevisionId ?? null,
    });

    // Generic update NEVER accepts post-confirm commercial correction from payload.
    if (commercialChange && commercialLocked) {
      throw new ConflictException(
        'CONFIRMED+ commercial fields are locked; use POST /scheduling/booking-integrity/appointments/:id/commercial-correction',
      );
    }

    if (commercialChange && !input.changeReason?.trim()) {
      throw new BadRequestException('changeReason is required for commercial revision');
    }

    const nextClinicalServiceId =
      input.clinicalServiceId !== undefined
        ? input.clinicalServiceId
        : snap?.clinicalServiceId ?? row.clinicalServiceId;

    const providerChanged =
      Boolean(input.providerId) && input.providerId !== appointment.providerId;
    const clinicalChanged =
      input.clinicalServiceId !== undefined &&
      input.clinicalServiceId !== (snap?.clinicalServiceId ?? row.clinicalServiceId);

    // Tentative slot values from pre-tx domain — MUST be recomputed from FOR UPDATE fresh row inside tx.
    const preTxStart = input.start ? new Date(input.start) : new Date(appointment.slot.start);
    const preTxEnd = input.end ? new Date(input.end) : new Date(appointment.slot.end);

    let resolvedCommercial = null as Awaited<
      ReturnType<BookingCommercialResolver['resolveCanonical']>
    > | null;
    if (commercialChange && nextClinicalServiceId) {
      await this.eligibility.assertClinicalServiceAccessible(
        tenant.tenantId,
        nextClinicalServiceId,
      );
      resolvedCommercial = await this.commercial.resolveCanonical({
        tenantId: tenant.tenantId,
        actorId,
        clinicalServiceId: nextClinicalServiceId,
        branchId,
        pricingUnit: (input.pricingUnit as ClinicalPricingUnit) ?? snap?.pricingUnit ?? ClinicalPricingUnit.PER_VISIT,
        currency: input.currency ?? snap?.currency ?? 'SYP',
        quantity: input.quantity ?? (snap ? Number(snap.quantity) : 1),
        commercialReason:
          input.commercialReason !== undefined
            ? input.commercialReason
            : snap?.commercialReason ?? null,
      });
    }

    if (wasCancelled && input.seriesScope === 'future' && seriesId) {
      const items = await this.repo.listSeriesFutureMembers({
        tenantId: tenant.tenantId,
        recurrenceSeriesId: seriesId,
        fromScheduledStart: appointment.slot.start,
      });
      for (const item of items) {
        const peerResources = [
          ...(item.resourceId ? [item.resourceId] : []),
        ];
        await this.concurrency.withBookingTransaction(async (client) => {
          const peer = await client.appointment.findFirst({
            where: { id: item.id, tenantId: tenant.tenantId, deletedAt: null },
            select: { id: true, status: true, commercialLockedAt: true, providerId: true },
          });
          if (!peer) return;
          const alloc = await this.concurrency.listAllocatedResourceIds(client, item.id);
          const lockResources = [...new Set([...peerResources, ...alloc])];
          await this.concurrency.acquireLocks(client, {
            tenantId: tenant.tenantId,
            providerId: peer.providerId,
            resourceIds: lockResources,
          });
          const fresh = await client.appointment.findFirst({
            where: { id: item.id, tenantId: tenant.tenantId, deletedAt: null },
            select: { id: true, status: true, commercialLockedAt: true },
          });
          if (!fresh || String(fresh.status).toUpperCase() === 'CANCELLED') return;
          const shouldLock = this.snapshots.shouldSetCommercialLock({
            priorStatus: fresh.status,
            nextStatus: PrismaAppointmentStatus.CANCELLED,
            commercialLockedAt: fresh.commercialLockedAt,
          });
          await client.appointment.update({
            where: { id: item.id },
            data: {
              status: PrismaAppointmentStatus.CANCELLED,
              cancellationReason: input.cancellationReason?.trim() || null,
              updatedAt: new Date(),
              ...(shouldLock ? { commercialLockedAt: new Date() } : {}),
            },
          });
        });
        await this.eventPublisher.publish(
          new AppointmentCancelledEvent(
            tenant.tenantId,
            appointment.branchId,
            item.id,
            appointment.patientId,
            item.providerId,
            item.start,
            item.end,
          ),
        );
      }
    }

    const applyingSeries = Boolean(input.start && input.end && input.seriesScope === 'future' && seriesId);

    if (applyingSeries) {
      await this.rescheduleSeriesFrom(
        tenant.tenantId,
        appointment,
        seriesId!,
        input.start!,
        input.end!,
      );
      const detail = await this.repo.findDetailById(id, tenant.tenantId);
      if (!detail) throw new NotFoundException('Appointment not found');
      return detail;
    }

    const needsBookingTx =
      slotAffecting ||
      commercialChange ||
      wasCancelled ||
      resourceIdsExplicitChange ||
      input.resourceId !== undefined ||
      Boolean(input.action);


    let nextProviderId = requestedProviderId;
    let nextStart = preTxStart;
    let nextEnd = preTxEnd;

    if (needsBookingTx) {
      if (input.start && input.end) {
        new TimeSlotVO(input.start, input.end);
      }

      const maxIdentityRetries = 3;
      let committed = false;
      for (let attempt = 1; attempt <= maxIdentityRetries && !committed; attempt++) {
        try {
          await this.concurrency.withBookingTransaction(async (client) => {
            const discovery = await client.appointment.findFirst({
              where: { id: appointment.id, tenantId: tenant.tenantId, deletedAt: null },
              select: {
                id: true,
                providerId: true,
                resourceId: true,
                clinicalServiceId: true,
                branchId: true,
                status: true,
                scheduledStart: true,
                scheduledEnd: true,
                commercialLockedAt: true,
                effectiveSnapshotRevisionId: true,
              },
            });
            if (!discovery) throw new NotFoundException('Appointment not found');

            const priorAlloc = await this.concurrency.listAllocatedResourceIds(client, appointment.id);
            const assumedEffProvider = input.providerId ?? discovery.providerId;
            let assumedEffResources: string[];
            if (input.resourceIds !== undefined) {
              assumedEffResources = [
                ...new Set(
                  [...input.resourceIds, ...(input.resourceId ? [input.resourceId] : [])].filter(
                    Boolean,
                  ) as string[],
                ),
              ];
            } else if (input.resourceId !== undefined) {
              assumedEffResources = input.resourceId ? [input.resourceId] : [];
            } else {
              assumedEffResources = [
                ...new Set([
                  ...priorAlloc,
                  ...(discovery.resourceId ? [discovery.resourceId] : []),
                ]),
              ];
            }
            const assumedProviderIds =
              assumedEffProvider !== discovery.providerId
                ? [discovery.providerId, assumedEffProvider]
                : [assumedEffProvider];
            const assumedResources = [
              ...new Set([
                ...assumedEffResources,
                ...priorAlloc,
                ...(discovery.resourceId ? [discovery.resourceId] : []),
              ]),
            ];

            if (slotAffecting || wasCancelled || resourceIdsExplicitChange) {
              await this.concurrency.acquireSortedLockKeys(
                client,
                this.concurrency.buildGlobalLockKeys({
                  tenantId: tenant.tenantId,
                  providerIds: assumedProviderIds,
                  resourceIds: assumedResources,
                }),
              );
            }

            const locked = await this.concurrency.lockAppointmentsForUpdate(client, {
              tenantId: tenant.tenantId,
              appointmentIds: [appointment.id],
            });
            const fresh = locked[0];
            if (!fresh) throw new NotFoundException('Appointment not found');

            // Omitted request fields → preserve POST-LOCK fresh DB values (never stale pre-tx).
            const effProviderId = input.providerId ?? fresh.providerId;
            const effStart = input.start ? new Date(input.start) : fresh.scheduledStart;
            const effEnd = input.end ? new Date(input.end) : fresh.scheduledEnd;
            const freshAlloc = await this.concurrency.listAllocatedResourceIds(client, appointment.id);
            let effResourceIds: string[];
            if (input.resourceIds !== undefined) {
              effResourceIds = [
                ...new Set(
                  [...input.resourceIds, ...(input.resourceId ? [input.resourceId] : [])].filter(
                    Boolean,
                  ) as string[],
                ),
              ];
            } else if (input.resourceId !== undefined) {
              effResourceIds = input.resourceId ? [input.resourceId] : [];
            } else {
              effResourceIds = [
                ...new Set([
                  ...freshAlloc,
                  ...(fresh.resourceId ? [fresh.resourceId] : []),
                ]),
              ];
            }

            const finalProviderIds =
              effProviderId !== fresh.providerId
                ? [fresh.providerId, effProviderId]
                : [effProviderId];
            const finalResources = [
              ...new Set([...effResourceIds, ...freshAlloc, ...(fresh.resourceId ? [fresh.resourceId] : [])]),
            ];
            const finalKeys = this.concurrency.buildGlobalLockKeys({
              tenantId: tenant.tenantId,
              providerIds: finalProviderIds,
              resourceIds: finalResources,
            });
            const assumedKeys = this.concurrency.buildGlobalLockKeys({
              tenantId: tenant.tenantId,
              providerIds: assumedProviderIds,
              resourceIds: assumedResources,
            });
            if (
              fresh.providerId !== discovery.providerId ||
              (fresh.resourceId ?? null) !== (discovery.resourceId ?? null) ||
              [...freshAlloc].sort().join(',') !== [...priorAlloc].sort().join(',') ||
              finalKeys.join('|') !== assumedKeys.join('|')
            ) {
              throw new SeriesLockIdentityChangedError();
            }

            nextProviderId = effProviderId;
            nextStart = effStart;
            nextEnd = effEnd;

            const freshDomainStatus = prismaAppointmentStatusToDomain(fresh.status);
            const statusResult = applyStatusAction(
              freshDomainStatus,
              input.action,
              input.cancellationReason ?? appointment.cancellationReason,
            );

            const shouldStampCommercialLock = this.snapshots.shouldSetCommercialLock({
              priorStatus: fresh.status,
              nextStatus: statusResult.status,
              commercialLockedAt: fresh.commercialLockedAt ?? null,
            });

            const effClinicalServiceId =
              input.clinicalServiceId !== undefined
                ? input.clinicalServiceId
                : fresh.clinicalServiceId;
            const effBranchId = fresh.branchId ?? branchId;

            if (slotAffecting) {
              await this.concurrency.assertNoOverlaps(client, {
                tenantId: tenant.tenantId,
                providerId: effProviderId,
                resourceIds: finalResources,
                start: effStart,
                end: effEnd,
                excludeAppointmentId: appointment.id,
              });
            }

            if (
              effClinicalServiceId &&
              (clinicalChanged ||
                Boolean(input.providerId && input.providerId !== fresh.providerId) ||
                slotAffecting ||
                commercialChange)
            ) {
              await this.eligibility.assertEligible({
                tenantId: tenant.tenantId,
                providerUserId: effProviderId,
                clinicalServiceId: effClinicalServiceId,
                branchId: effBranchId,
                at: effStart,
                client,
              });
            }

            if (effClinicalServiceId && (slotAffecting || commercialChange || resourceIdsExplicitChange)) {
              await this.resources.assertRequirementsSatisfied({
                tenantId: tenant.tenantId,
                clinicalServiceId: effClinicalServiceId,
                branchId: effBranchId,
                allocatedResourceIds: effResourceIds,
                client,
              });
            } else if (effResourceIds.length > 0) {
              await this.resources.assertAllocatedResourcesOwned({
                tenantId: tenant.tenantId,
                branchId: effBranchId,
                allocatedResourceIds: effResourceIds,
                client,
              });
            }

            // Wave E Round 1 E2 — course interval invariant on reschedule
            if (slotAffecting) {
              await assertCourseIntervalsForReschedule(
                client,
                tenant.tenantId,
                appointment.id,
                effStart,
              );
            }

            const data: Prisma.AppointmentUncheckedUpdateInput = {
              providerId: effProviderId,
              scheduledStart: effStart,
              scheduledEnd: effEnd,
              resourceId: effResourceIds[0] ?? (resourceIdsExplicitChange ? null : fresh.resourceId ?? null),
              status: DOMAIN_TO_PRISMA[statusResult.status],
              updatedAt: new Date(),
            };
            if (shouldStampCommercialLock) {
              data.commercialLockedAt = new Date();
            }
            if (input.notes !== undefined) data.notes = input.notes;
            if (statusResult.cancellationReason !== undefined) {
              data.cancellationReason = statusResult.cancellationReason;
            }
            if (input.serviceType !== undefined) data.serviceType = input.serviceType;
            if (input.isEmergency !== undefined) data.isEmergency = input.isEmergency;
            if (input.clinicalServiceId !== undefined) {
              data.clinicalServiceId = input.clinicalServiceId;
            }

            await client.appointment.update({
              where: { id: appointment.id },
              data,
            });

            if (
              input.resourceIds !== undefined ||
              input.resourceId !== undefined ||
              commercialChange ||
              slotAffecting
            ) {
              await this.concurrency.replaceResourceAllocations(client, {
                tenantId: tenant.tenantId,
                appointmentId: appointment.id,
                resourceIds: effResourceIds,
              });
            }

            if (commercialChange && resolvedCommercial) {
              const rev = await this.snapshots.appendResolvedCommercialRevision(client, {
                tenantId: tenant.tenantId,
                appointmentId: appointment.id,
                changeReason: input.changeReason!.trim(),
                actorId,
                commercial: resolvedCommercial,
                allowPostConfirmCorrection: false,
                appointmentStatus: fresh.status,
              });
              await this.auditLog.recordInTransaction(client, {
                tenantId: tenant.tenantId,
                action: 'scheduling.snapshot.revision',
                resourceId: rev.id,
                actorId,
                actorRoles: [],
                descriptionEn: 'Pre-confirm commercial snapshot revision appended',
                descriptionAr: 'تم إلحاق مراجعة تجارية قبل التأكيد',
                details: { appointmentId: appointment.id, revisionNumber: rev.revisionNumber },
              });
            }
          });
          committed = true;
        } catch (err) {
          if (err instanceof SeriesLockIdentityChangedError) {
            if (attempt >= maxIdentityRetries) {
              throw new ConflictException(
                'Appointment lock-relevant identity changed repeatedly under concurrency; aborting',
              );
            }
            continue;
          }
          throw err;
        }
      }
      if (!committed) {
        throw new ConflictException('Appointment update could not stabilize lock identities');
      }
    } else {
      if (input.action === 'confirm') appointment.confirm();
      else if (input.action === 'complete') appointment.complete();
      else if (input.action === 'no_show') appointment.markNoShow();
      else if (input.action === 'check_in') appointment.checkIn();
      else if (input.action === 'start_visit') appointment.startVisit();

      if (input.serviceType !== undefined && !commercialChange) {
        appointment.serviceType = input.serviceType;
        appointment.updatedAt = new Date();
      }
      if (input.isEmergency !== undefined) {
        appointment.isEmergency = input.isEmergency;
        appointment.updatedAt = new Date();
      }
      if (input.notes !== undefined) {
        appointment.notes = input.notes;
      }

      await this.repo.save(appointment);
    }

    if (wasCancelled && !(input.seriesScope === 'future' && seriesId)) {
      await this.eventPublisher.publish(
        new AppointmentCancelledEvent(
          tenant.tenantId,
          appointment.branchId,
          appointment.id,
          appointment.patientId,
          nextProviderId,
          input.start ?? nextStart.toISOString(),
          input.end ?? nextEnd.toISOString(),
        ),
      );
    }

    const detail = await this.repo.findDetailById(id, tenant.tenantId);
    if (!detail) throw new NotFoundException('Appointment not found');
    return detail;
  }

  private isCommercialFieldChange(
    input: UpdateAppointmentInput,
    row: {
      clinicalServiceId: string | null;
      serviceType?: string | null;
    },
    appointment: { serviceType?: string | null },
    snap: {
      clinicalServiceId: string | null;
      quantity: { toString(): string } | number;
      pricingUnit: string;
      currency: string;
      commercialReason: string | null;
    } | null,
  ): boolean {
    const effectiveClinical = snap?.clinicalServiceId ?? row.clinicalServiceId;
    if (input.clinicalServiceId !== undefined && input.clinicalServiceId !== effectiveClinical) {
      return true;
    }
    if (input.serviceType !== undefined && input.serviceType !== appointment.serviceType) {
      return true;
    }
    if (!snap) {
      return (
        input.quantity !== undefined ||
        input.pricingUnit !== undefined ||
        input.currency !== undefined ||
        input.commercialReason !== undefined
      ) && (input.clinicalServiceId !== undefined || Boolean(row.clinicalServiceId));
    }
    if (input.quantity !== undefined && Number(snap.quantity) !== Number(input.quantity)) {
      return true;
    }
    if (input.pricingUnit !== undefined && String(snap.pricingUnit) !== String(input.pricingUnit)) {
      return true;
    }
    if (input.currency !== undefined && snap.currency !== input.currency) {
      return true;
    }
    if (
      input.commercialReason !== undefined &&
      (snap.commercialReason ?? null) !== (input.commercialReason ?? null)
    ) {
      return true;
    }
    return false;
  }

  private async rescheduleSeriesFrom(
    tenantId: string,
    anchor: {
      id: string;
      slot: TimeSlotVO;
      recurrenceSeriesId: string | null;
      providerId: string;
      resourceId: string | null;
      branchId: string | null;
    },
    seriesId: string,
    newStartIso: string,
    newEndIso: string,
  ): Promise<boolean> {
    const deltaMs = new Date(newStartIso).getTime() - new Date(anchor.slot.start).getTime();
    const durationMs = new Date(newEndIso).getTime() - new Date(newStartIso).getTime();
    const maxIdentityRetries = 3;
    const pageSize = process.env.WAVE_B_SERIES_PAGE_SIZE
      ? Number(process.env.WAVE_B_SERIES_PAGE_SIZE)
      : undefined;

    for (let attempt = 1; attempt <= maxIdentityRetries; attempt++) {
      // Rediscover peers every attempt (authoritative; no stale peer set).
      const peers = await this.repo.listSeriesFutureMembers({
        tenantId,
        recurrenceSeriesId: seriesId,
        fromScheduledStart: anchor.slot.start,
        pageSize,
      });
      if (peers.length === 0) return false;
      const excludeAppointmentIds = peers.map((p) => p.id);

      try {
        // Each attempt = a separate transaction. Advisory xact locks from a failed
        // attempt are released on rollback — never acquire extra keys in the same tx.
        await this.concurrency.withBookingTransaction(async (client) => {
          const rows = await client.appointment.findMany({
            where: {
              id: { in: excludeAppointmentIds },
              tenantId,
              deletedAt: null,
            },
            select: {
              id: true,
              providerId: true,
              clinicalServiceId: true,
              branchId: true,
              resourceId: true,
              status: true,
              effectiveSnapshotRevisionId: true,
              commercialLockedAt: true,
              scheduledStart: true,
              scheduledEnd: true,
            },
          });
          if (rows.length !== excludeAppointmentIds.length) {
            throw new ConflictException('Series peer set changed during reschedule; retry');
          }

          const allocById = new Map<string, string[]>();
          const allResourceIds: string[] = [];
          const allProviderIds: string[] = [];
          for (const row of rows) {
            if (String(row.status).toUpperCase() === 'CANCELLED') {
              throw new ConflictException(`Series peer ${row.id} is cancelled`);
            }
            const alloc = await this.concurrency.listAllocatedResourceIds(client, row.id);
            allocById.set(row.id, alloc);
            allResourceIds.push(...alloc, ...(row.resourceId ? [row.resourceId] : []));
            allProviderIds.push(row.providerId);
          }

          const globalKeys = this.concurrency.buildGlobalLockKeys({
            tenantId,
            providerIds: allProviderIds,
            resourceIds: allResourceIds,
          });
          // Exactly one globally sorted acquisition pass for this transaction attempt.
          await this.concurrency.acquireSortedLockKeys(client, globalKeys);

          // Stabilize appointment identity: deterministic FOR UPDATE row locks (id ASC).
          const freshRows = await this.concurrency.lockAppointmentsForUpdate(client, {
            tenantId,
            appointmentIds: excludeAppointmentIds,
          });
          if (freshRows.length !== excludeAppointmentIds.length) {
            throw new ConflictException('Series peer disappeared under lock');
          }

          const freshAllocById = new Map<string, string[]>();
          for (const row of freshRows) {
            if (String(row.status).toUpperCase() === 'CANCELLED') {
              throw new ConflictException(`Series peer ${row.id} cancelled under lock`);
            }
            const prior = rows.find((r) => r.id === row.id)!;
            const alloc = await this.concurrency.listAllocatedResourceIds(client, row.id);
            freshAllocById.set(row.id, alloc);
            const priorAlloc = [...(allocById.get(row.id) ?? [])].sort().join(',');
            const nextAlloc = [...alloc].sort().join(',');
            if (
              prior.providerId !== row.providerId ||
              (prior.resourceId ?? null) !== (row.resourceId ?? null) ||
              priorAlloc !== nextAlloc
            ) {
              // Do NOT acquire additional keys in this transaction — abort for NEW tx retry.
              throw new SeriesLockIdentityChangedError();
            }
          }

          const byId = new Map(freshRows.map((r) => [r.id, r]));
          const planned = freshRows
            .slice()
            .sort((a, b) => {
              const ds = a.scheduledStart.getTime() - b.scheduledStart.getTime();
              return ds !== 0 ? ds : a.id.localeCompare(b.id);
            })
            .map((row) => {
              const peerStart = new Date(row.scheduledStart.getTime() + deltaMs);
              const peerEnd = new Date(peerStart.getTime() + durationMs);
              return { id: row.id, peerStart, peerEnd };
            });

          for (const plan of planned) {
            const row = byId.get(plan.id)!;
            const alloc = freshAllocById.get(plan.id) ?? [];
            const lockResources = [
              ...new Set([...alloc, ...(row.resourceId ? [row.resourceId] : [])]),
            ];
            await this.concurrency.assertNoOverlaps(client, {
              tenantId,
              providerId: row.providerId,
              resourceIds: lockResources,
              start: plan.peerStart,
              end: plan.peerEnd,
              excludeAppointmentIds,
            });

            if (row.clinicalServiceId) {
              await this.eligibility.assertEligible({
                tenantId,
                providerUserId: row.providerId,
                clinicalServiceId: row.clinicalServiceId,
                branchId: row.branchId ?? anchor.branchId ?? null,
                at: plan.peerStart,
                client,
              });
              await this.resources.assertRequirementsSatisfied({
                tenantId,
                clinicalServiceId: row.clinicalServiceId,
                branchId: row.branchId ?? anchor.branchId ?? null,
                allocatedResourceIds: lockResources,
                client,
              });
            }
          }

          for (const plan of planned) {
            const row = byId.get(plan.id)!;
            await client.appointment.update({
              where: { id: plan.id },
              data: {
                scheduledStart: plan.peerStart,
                scheduledEnd: plan.peerEnd,
                updatedAt: new Date(),
                effectiveSnapshotRevisionId: row.effectiveSnapshotRevisionId,
                commercialLockedAt: row.commercialLockedAt,
              },
            });
          }
        });
        return true;
      } catch (err) {
        if (err instanceof SeriesLockIdentityChangedError) {
          if (attempt >= maxIdentityRetries) {
            throw new ConflictException(
              'Series lock-relevant identity changed repeatedly under concurrency; aborting',
            );
          }
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException('Series reschedule could not stabilize lock identities');
  }
}

/** Sentinel: post-lock identity mismatch — caller must retry in a NEW transaction. */
export class SeriesLockIdentityChangedError extends Error {
  constructor() {
    super('SERIES_LOCK_IDENTITY_CHANGED');
    this.name = 'SeriesLockIdentityChangedError';
  }
}

@Injectable()
export class SchedulingMetricsHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(from: string, to: string) {
    const tenant = await this.tenantContext.resolve();
    const { items, total } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      from,
      to,
      limit: 500,
      offset: 0,
    });

    const byStatus = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total,
      pending: byStatus.pending ?? 0,
      confirmed: byStatus.confirmed ?? 0,
      checkedIn: byStatus.checked_in ?? 0,
      inProgress: byStatus.in_progress ?? 0,
      completed: byStatus.completed ?? 0,
      cancelled: byStatus.cancelled ?? 0,
      noShow: byStatus.no_show ?? 0,
      utilizationPercent:
        total > 0
          ? Math.round(((byStatus.completed ?? 0) / total) * 100)
          : 0,
    };
  }
}

@Injectable()
export class SchedulingAnalyticsHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(from: string, to: string) {
    const tenant = await this.tenantContext.resolve();
    const { items } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      from,
      to,
      limit: 500,
      offset: 0,
    });

    const total = items.length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const cancelled = items.filter((i) => i.status === 'cancelled').length;
    const noShow = items.filter((i) => i.status === 'no_show').length;
    const emergency = items.filter((i) => i.isEmergency).length;

    const dailyMap = new Map<string, { date: string; total: number; completed: number; cancelled: number; noShow: number }>();
    for (const item of items) {
      const date = item.start.slice(0, 10);
      const row = dailyMap.get(date) ?? { date, total: 0, completed: 0, cancelled: 0, noShow: 0 };
      row.total += 1;
      if (item.status === 'completed') row.completed += 1;
      if (item.status === 'cancelled') row.cancelled += 1;
      if (item.status === 'no_show') row.noShow += 1;
      dailyMap.set(date, row);
    }

    const byServiceType = new Map<string, number>();
    for (const item of items) {
      const key = item.serviceType ?? 'unspecified';
      byServiceType.set(key, (byServiceType.get(key) ?? 0) + 1);
    }

    const attended = completed + noShow;
    return {
      total,
      completed,
      cancelled,
      noShow,
      emergency,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      noShowRate: attended > 0 ? Math.round((noShow / attended) * 100) : 0,
      dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byServiceType: Array.from(byServiceType.entries())
        .map(([serviceType, count]) => ({ serviceType, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}

@Injectable()
export class BulkRescheduleHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
    private readonly concurrency: BookingConcurrencyService,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: { appointmentIds: string[]; shiftDays: number }) {
    if (!input.appointmentIds?.length) {
      throw new BadRequestException('appointmentIds is required');
    }
    if (input.shiftDays === 0) {
      throw new BadRequestException('shiftDays must not be zero');
    }

    const tenant = await this.tenantContext.resolve();
    const failed: Array<{ id: string; reason: string }> = [];
    const candidateIds: string[] = [];

    for (const id of input.appointmentIds.slice(0, 50)) {
      const appointment = await this.repo.findById(id, tenant.tenantId);
      if (!appointment) {
        failed.push({ id, reason: 'not_found' });
        continue;
      }
      if (
        appointment.status === AppointmentStatus.Cancelled ||
        appointment.status === AppointmentStatus.Completed ||
        appointment.status === AppointmentStatus.NoShow
      ) {
        failed.push({ id, reason: 'terminal_status' });
        continue;
      }
      candidateIds.push(id);
    }

    if (candidateIds.length === 0) {
      return { updated: [] as string[], failed, shiftDays: input.shiftDays };
    }

    const maxIdentityRetries = 3;
    for (let attempt = 1; attempt <= maxIdentityRetries; attempt++) {
      try {
        await this.concurrency.withBookingTransaction(async (client) => {
          // Discovery read (pre-lock) — used only to build advisory key assumptions.
          const discovery = await client.appointment.findMany({
            where: {
              id: { in: candidateIds },
              tenantId: tenant.tenantId,
              deletedAt: null,
            },
            select: {
              id: true,
              providerId: true,
              resourceId: true,
              clinicalServiceId: true,
              branchId: true,
              status: true,
              scheduledStart: true,
              scheduledEnd: true,
            },
          });
          if (discovery.length !== candidateIds.length) {
            throw new ConflictException('Bulk peer set changed during reschedule; retry');
          }

          const allocById = new Map<string, string[]>();
          const allProviderIds: string[] = [];
          const allResourceIds: string[] = [];
          for (const row of discovery) {
            if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(row.status).toUpperCase())) {
              throw new ConflictException(`Bulk peer ${row.id} is terminal`);
            }
            const alloc = await this.concurrency.listAllocatedResourceIds(client, row.id);
            allocById.set(row.id, alloc);
            allProviderIds.push(row.providerId);
            allResourceIds.push(...alloc, ...(row.resourceId ? [row.resourceId] : []));
          }

          const globalKeys = this.concurrency.buildGlobalLockKeys({
            tenantId: tenant.tenantId,
            providerIds: allProviderIds,
            resourceIds: allResourceIds,
          });
          await this.concurrency.acquireSortedLockKeys(client, globalKeys);

          const freshRows = await this.concurrency.lockAppointmentsForUpdate(client, {
            tenantId: tenant.tenantId,
            appointmentIds: candidateIds,
          });
          if (freshRows.length !== candidateIds.length) {
            throw new ConflictException('Bulk peer disappeared under lock');
          }

          const freshAllocById = new Map<string, string[]>();
          for (const row of freshRows) {
            if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(row.status).toUpperCase())) {
              throw new ConflictException(`Bulk peer ${row.id} terminal under lock`);
            }
            const prior = discovery.find((d) => d.id === row.id)!;
            const alloc = await this.concurrency.listAllocatedResourceIds(client, row.id);
            freshAllocById.set(row.id, alloc);
            const priorAlloc = [...(allocById.get(row.id) ?? [])].sort().join(',');
            const nextAlloc = [...alloc].sort().join(',');
            if (
              prior.providerId !== row.providerId ||
              (prior.resourceId ?? null) !== (row.resourceId ?? null) ||
              priorAlloc !== nextAlloc
            ) {
              throw new SeriesLockIdentityChangedError();
            }
          }

          const planned = freshRows.map((row) => {
            const peerStart = new Date(row.scheduledStart);
            const peerEnd = new Date(row.scheduledEnd);
            peerStart.setDate(peerStart.getDate() + input.shiftDays);
            peerEnd.setDate(peerEnd.getDate() + input.shiftDays);
            return { id: row.id, peerStart, peerEnd, row };
          });

          for (const plan of planned) {
            const alloc = freshAllocById.get(plan.id) ?? [];
            const lockResources = [
              ...new Set([...alloc, ...(plan.row.resourceId ? [plan.row.resourceId] : [])]),
            ];
            await this.concurrency.assertNoOverlaps(client, {
              tenantId: tenant.tenantId,
              providerId: plan.row.providerId,
              resourceIds: lockResources,
              start: plan.peerStart,
              end: plan.peerEnd,
              excludeAppointmentIds: candidateIds,
            });
            if (plan.row.clinicalServiceId) {
              await this.eligibility.assertEligible({
                tenantId: tenant.tenantId,
                providerUserId: plan.row.providerId,
                clinicalServiceId: plan.row.clinicalServiceId,
                branchId: plan.row.branchId ?? tenant.branchId ?? null,
                at: plan.peerStart,
                client,
              });
              await this.resources.assertRequirementsSatisfied({
                tenantId: tenant.tenantId,
                clinicalServiceId: plan.row.clinicalServiceId,
                branchId: plan.row.branchId ?? tenant.branchId ?? null,
                allocatedResourceIds: lockResources,
                client,
              });
            }
          }

          for (const plan of planned) {
            const alloc = freshAllocById.get(plan.id) ?? [];
            const lockResources = [
              ...new Set([...alloc, ...(plan.row.resourceId ? [plan.row.resourceId] : [])]),
            ];
            await client.appointment.update({
              where: { id: plan.id },
              data: {
                scheduledStart: plan.peerStart,
                scheduledEnd: plan.peerEnd,
                updatedAt: new Date(),
              },
            });
            if (lockResources.length) {
              await this.concurrency.replaceResourceAllocations(client, {
                tenantId: tenant.tenantId,
                appointmentId: plan.id,
                resourceIds: lockResources,
              });
            }
          }
        });

        return {
          updated: candidateIds,
          failed,
          shiftDays: input.shiftDays,
        };
      } catch (err) {
        if (err instanceof SeriesLockIdentityChangedError) {
          if (attempt >= maxIdentityRetries) {
            for (const id of candidateIds) {
              failed.push({
                id,
                reason: 'lock_identity_unstable',
              });
            }
            return { updated: [] as string[], failed, shiftDays: input.shiftDays };
          }
          continue;
        }
        const reason =
          err instanceof ConflictException
            ? 'provider_conflict'
            : err instanceof Error
              ? err.message
              : 'unknown';
        for (const id of candidateIds) {
          failed.push({ id, reason });
        }
        return { updated: [] as string[], failed, shiftDays: input.shiftDays };
      }
    }

    for (const id of candidateIds) {
      failed.push({ id, reason: 'lock_identity_unstable' });
    }
    return { updated: [] as string[], failed, shiftDays: input.shiftDays };
  }
}

@Injectable()
export class DeleteAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
    private readonly concurrency: BookingConcurrencyService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const appointment = await this.repo.findById(id, tenant.tenantId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    await this.concurrency.withBookingTransaction(async (client) => {
      const alloc = await this.concurrency.listAllocatedResourceIds(client, id);
      const resourceIds = [
        ...alloc,
        ...(appointment.resourceId ? [appointment.resourceId] : []),
      ];
      await this.concurrency.acquireLocks(client, {
        tenantId: tenant.tenantId,
        providerId: appointment.providerId,
        resourceIds,
      });
      const result = await client.appointment.updateMany({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      });
      if (!result.count) throw new NotFoundException('Appointment not found');
    });

    return { id, deleted: true };
  }
}
