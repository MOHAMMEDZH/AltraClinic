import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentSnapshotService } from './appointment-snapshot.service';
import { BookingConcurrencyService } from './booking-concurrency.service';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';

export type QueueLifecycleAppointmentStatus =
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED';

/**
 * Shared Appointment lifecycle mutation used by Queue (and others).
 *
 * Row-serialized: FOR UPDATE on the Appointment row inside the caller transaction,
 * then decide transition / commercialLockedAt from that fresh locked state.
 * Never clears or re-stamps an existing commercialLockedAt.
 */
@Injectable()
export class AppointmentLifecycleMutationService {
  constructor(
    private readonly snapshots: AppointmentSnapshotService,
    private readonly concurrency: BookingConcurrencyService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async applyStatus(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      appointmentId: string;
      nextStatus: QueueLifecycleAppointmentStatus;
      now: Date;
      actorId: string;
      /** Prisma status filter matching prior Queue updateMany semantics. */
      statusNotIn?: string[];
    },
  ): Promise<{ applied: boolean; commercialLockedAt: Date | null }> {
    const statusNotIn = params.statusNotIn ?? ['CANCELLED', 'COMPLETED', 'NO_SHOW'];

    // Authoritative decision uses locked fresh row in THIS transaction only.
    const locked = await this.concurrency.lockAppointmentsForUpdate(client, {
      tenantId: params.tenantId,
      appointmentIds: [params.appointmentId],
    });
    const row = locked[0];
    if (!row) {
      return { applied: false, commercialLockedAt: null };
    }

    if (statusNotIn.includes(String(row.status))) {
      return {
        applied: false,
        commercialLockedAt: row.commercialLockedAt ?? null,
      };
    }

    const shouldLock = this.snapshots.shouldSetCommercialLock({
      priorStatus: row.status,
      nextStatus: params.nextStatus,
      commercialLockedAt: row.commercialLockedAt,
    });

    const updated = await client.appointment.update({
      where: { id: row.id },
      data: {
        status: params.nextStatus,
        updatedAt: params.now,
        ...(shouldLock ? { commercialLockedAt: params.now } : {}),
      },
      select: { commercialLockedAt: true },
    });

    await this.auditLog.recordInTransaction(client, {
      tenantId: params.tenantId,
      action: 'scheduling.lifecycle.status',
      resourceId: row.id,
      actorId: params.actorId,
      actorRoles: [],
      descriptionEn: `Appointment lifecycle status → ${params.nextStatus}`,
      descriptionAr: `تم تحديث حالة الموعد إلى ${params.nextStatus}`,
      details: {
        appointmentId: row.id,
        fromStatus: String(row.status),
        toStatus: params.nextStatus,
        commercialLockStamped: shouldLock,
      },
    });

    return {
      applied: true,
      commercialLockedAt: updated.commercialLockedAt ?? null,
    };
  }
}
