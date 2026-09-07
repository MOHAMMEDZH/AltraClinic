import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { RealtimeBroadcastService } from '../../../realtime/application/services/realtime-broadcast.service';
import { QueueBoardService } from '../services/queue-board.service';
import { QueueEventService } from '../services/queue-event.service';
import { BookingConcurrencyService } from '../../../scheduling/application/services/booking-concurrency.service';
import { ServiceResourceRequirementService } from '../../../scheduling/application/services/service-resource-requirement.service';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../../../scheduling/application/ports/scheduling-audit-log.port';

export class AssignQueueRoomDTO {
  @IsOptional()
  @IsUUID()
  resourceId?: string | null;
}

class QueueAssignRoomIdentityChangedError extends Error {
  constructor() {
    super('Queue assignRoom lock-relevant identity changed');
    this.name = 'QueueAssignRoomIdentityChangedError';
  }
}

/**
 * Wave B: queue room assignment is a scheduling mutation.
 * Uses BookingConcurrencyService + FOR UPDATE + fresh allocations.
 * AppointmentResourceAllocation is authoritative; Appointment.resourceId is legacy mirror.
 */
@Injectable()
export class AssignQueueRoomHandler {
  constructor(
    private readonly board: QueueBoardService,
    private readonly tenantContext: TenantContextService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly events: QueueEventService,
    private readonly concurrency: BookingConcurrencyService,
    private readonly resources: ServiceResourceRequirementService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async execute(
    queueTicketId: string,
    resourceId: string | null,
    authenticatedActorId: string,
  ) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException('authenticatedActorId is required for queue room assignment');
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();

    const ticket = await this.board.findTicketForAssign(tenant.tenantId, queueTicketId);
    if (!ticket) throw new NotFoundException('Queue ticket not found');

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.concurrency.withBookingTransaction(async (client) => {
          const discovery = await client.appointment.findFirst({
            where: {
              id: ticket.appointmentId,
              tenantId: tenant.tenantId,
              deletedAt: null,
            },
          });
          if (!discovery) throw new NotFoundException('Appointment not found for queue ticket');

          const priorAlloc = await this.concurrency.listAllocatedResourceIds(
            client,
            discovery.id,
          );
          const assumedResources = [
            ...new Set([
              ...priorAlloc,
              ...(discovery.resourceId ? [discovery.resourceId] : []),
              ...(resourceId ? [resourceId] : []),
            ]),
          ];
          await this.concurrency.acquireSortedLockKeys(
            client,
            this.concurrency.buildGlobalLockKeys({
              tenantId: tenant.tenantId,
              providerIds: [discovery.providerId],
              resourceIds: assumedResources,
            }),
          );

          const locked = await this.concurrency.lockAppointmentsForUpdate(client, {
            tenantId: tenant.tenantId,
            appointmentIds: [discovery.id],
          });
          const fresh = locked[0];
          if (!fresh) throw new NotFoundException('Appointment disappeared under lock');

          const freshAlloc = await this.concurrency.listAllocatedResourceIds(client, fresh.id);
          if (
            fresh.providerId !== discovery.providerId ||
            (fresh.resourceId ?? null) !== (discovery.resourceId ?? null) ||
            [...freshAlloc].sort().join(',') !== [...priorAlloc].sort().join(',')
          ) {
            throw new QueueAssignRoomIdentityChangedError();
          }

          const allocRows = await client.appointmentResourceAllocation.findMany({
            where: { appointmentId: fresh.id },
            include: { schedulingResource: { select: { id: true, resourceType: true } } },
          });
          const nonRoomIds = allocRows
            .filter((a) => a.schedulingResource.resourceType !== 'ROOM')
            .map((a) => a.schedulingResourceId);
          let nextAllocIds = [...nonRoomIds];
          if (resourceId) {
            nextAllocIds = [...new Set([...nextAllocIds, resourceId])];
          }

          const finalKeys = this.concurrency.buildGlobalLockKeys({
            tenantId: tenant.tenantId,
            providerIds: [fresh.providerId],
            resourceIds: [
              ...new Set([
                ...nextAllocIds,
                ...freshAlloc,
                ...(fresh.resourceId ? [fresh.resourceId] : []),
                ...(resourceId ? [resourceId] : []),
              ]),
            ],
          });
          const assumedKeys = this.concurrency.buildGlobalLockKeys({
            tenantId: tenant.tenantId,
            providerIds: [discovery.providerId],
            resourceIds: assumedResources,
          });
          if (finalKeys.join('|') !== assumedKeys.join('|')) {
            throw new QueueAssignRoomIdentityChangedError();
          }

          if (fresh.clinicalServiceId) {
            await this.resources.assertRequirementsSatisfied({
              tenantId: tenant.tenantId,
              clinicalServiceId: fresh.clinicalServiceId,
              branchId: fresh.branchId ?? tenant.branchId ?? null,
              allocatedResourceIds: nextAllocIds,
              client,
            });
          } else if (nextAllocIds.length > 0) {
            await this.resources.assertAllocatedResourcesOwned({
              tenantId: tenant.tenantId,
              branchId: fresh.branchId ?? tenant.branchId ?? null,
              allocatedResourceIds: nextAllocIds,
              client,
            });
          }

          await this.concurrency.assertNoOverlaps(client, {
            tenantId: tenant.tenantId,
            providerId: fresh.providerId,
            resourceIds: nextAllocIds,
            start: fresh.scheduledStart,
            end: fresh.scheduledEnd,
            excludeAppointmentId: fresh.id,
          });

          await this.concurrency.replaceResourceAllocations(client, {
            tenantId: tenant.tenantId,
            appointmentId: fresh.id,
            resourceIds: nextAllocIds,
          });

          await client.appointment.update({
            where: { id: fresh.id },
            data: {
              resourceId: resourceId ?? nextAllocIds[0] ?? null,
              updatedAt: new Date(),
            },
          });

          await client.queueTicket.update({
            where: { id: queueTicketId },
            data: { resourceId },
          });

          await this.auditLog.recordInTransaction(client, {
            tenantId: tenant.tenantId,
            action: 'queue.room_assigned',
            resourceId: fresh.id,
            actorId,
            actorRoles: [],
            descriptionEn: 'Queue room assignment updated under booking integrity locks',
            descriptionAr: 'تم تحديث تعيين غرفة قائمة الانتظار ضمن أقفال سلامة الحجز',
            details: {
              queueTicketId,
              appointmentId: fresh.id,
              resourceId: resourceId ?? null,
            },
          });

          let resourceName: string | null = null;
          if (resourceId) {
            const resource = await client.schedulingResource.findFirst({
              where: {
                id: resourceId,
                tenantId: tenant.tenantId,
                deletedAt: null,
              },
              select: { name: true },
            });
            resourceName = resource?.name ?? null;
          }

          await this.events.record(
            {
              tenantId: tenant.tenantId,
              queueTicketId,
              action: 'room_assigned',
              actorUserId: actorId,
              metadata: { resourceId, resourceName },
            },
            client,
          );
        });
        break;
      } catch (err) {
        if (err instanceof QueueAssignRoomIdentityChangedError) {
          if (attempt >= maxRetries) {
            throw new ConflictException(
              'Queue room assignment could not stabilize lock identities',
            );
          }
          continue;
        }
        throw err;
      }
    }

    // Post-commit: presentation / realtime only (immutable QueueTicketEvent already committed).
    const item = await this.board.getBoardItemAfterAssign(tenant.tenantId, queueTicketId);
    if (!item) throw new NotFoundException('Queue ticket not found');

    await this.broadcast.publish({
      eventId: `queue-room-${queueTicketId}-${Date.now()}`,
      tenantId: tenant.tenantId,
      branchId: item.branchId,
      channel: 'queue',
      type: 'queue.room_assigned',
      payload: item as unknown as Record<string, unknown>,
    });

    return item;
  }
}
