import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { AppointmentStatus } from '../../domain/appointment-status.enum';
import { TimeSlotVO } from '../../domain/timeslot.vo';
import { AppointmentCancelledEvent } from '../../domain/events/appointment-cancelled.event';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';

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
  ) {}

  async execute(
    id: string,
    input: {
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
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    const appointment = await this.repo.findById(id, tenant.tenantId);
    if (!appointment) throw new NotFoundException('Appointment not found');

    const wasCancelled = input.action === 'cancel';
    const seriesId = appointment.recurrenceSeriesId;

    if (wasCancelled && input.seriesScope === 'future' && seriesId) {
      const { items } = await this.repo.list({
        tenantId: tenant.tenantId,
        branchId: appointment.branchId,
        from: appointment.slot.start,
        limit: 200,
        offset: 0,
      });
      for (const item of items) {
        if (item.recurrenceSeriesId !== seriesId) continue;
        if (new Date(item.start).getTime() < new Date(appointment.slot.start).getTime()) continue;
        const peer = await this.repo.findById(item.id, tenant.tenantId);
        if (!peer || peer.status === AppointmentStatus.Cancelled) continue;
        peer.cancel(input.cancellationReason);
        await this.repo.save(peer);
        await this.eventPublisher.publish(
          new AppointmentCancelledEvent(
            tenant.tenantId,
            peer.branchId,
            peer.id,
            peer.patientId,
            peer.providerId,
            peer.slot.start,
            peer.slot.end,
          ),
        );
      }
    }

    if (input.action === 'confirm') appointment.confirm();
    else if (input.action === 'cancel') appointment.cancel(input.cancellationReason);
    else if (input.action === 'complete') appointment.complete();
    else if (input.action === 'no_show') appointment.markNoShow();
    else if (input.action === 'check_in') appointment.checkIn();
    else if (input.action === 'start_visit') appointment.startVisit();

    if (input.providerId && input.providerId !== appointment.providerId) {
      (appointment as { providerId: string }).providerId = input.providerId;
      appointment.updatedAt = new Date();
    }
    if (input.serviceType !== undefined) {
      appointment.serviceType = input.serviceType;
      appointment.updatedAt = new Date();
    }
    if (input.isEmergency !== undefined) {
      appointment.isEmergency = input.isEmergency;
      appointment.updatedAt = new Date();
    }
    if (input.resourceId !== undefined) {
      appointment.resourceId = input.resourceId;
      appointment.updatedAt = new Date();
    }

    if (input.start && input.end) {
      const applyingSeries =
        input.seriesScope === 'future' && Boolean(seriesId);

      if (!applyingSeries) {
        const slot = new TimeSlotVO(input.start, input.end);
        const conflict = await this.repo.findByProviderAndSlot(
          appointment.providerId,
          slot,
          tenant.tenantId,
          appointment.id,
        );
        if (conflict) throw new ConflictException('Provider slot conflict');
        appointment.reschedule(slot);
      }
    }

    if (input.notes !== undefined) {
      appointment.notes = input.notes;
    }

    if (
      appointment.status === AppointmentStatus.Cancelled ||
      appointment.status === AppointmentStatus.Completed ||
      appointment.status === AppointmentStatus.NoShow
    ) {
      // allow status-only updates
    }

    let seriesRescheduled = false;
    if (input.start && input.end && input.seriesScope === 'future' && seriesId) {
      seriesRescheduled = await this.rescheduleSeriesFrom(
        tenant.tenantId,
        appointment,
        seriesId,
        input.start,
        input.end,
      );
    }

    if (seriesRescheduled) {
      const detail = await this.repo.findDetailById(id, tenant.tenantId);
      if (!detail) throw new NotFoundException('Appointment not found');
      return detail;
    }

    await this.repo.save(appointment);

    if (wasCancelled) {
      await this.eventPublisher.publish(
        new AppointmentCancelledEvent(
          tenant.tenantId,
          appointment.branchId,
          appointment.id,
          appointment.patientId,
          appointment.providerId,
          appointment.slot.start,
          appointment.slot.end,
        ),
      );
    }

    const detail = await this.repo.findDetailById(id, tenant.tenantId);
    if (!detail) throw new NotFoundException('Appointment not found');
    return detail;
  }

  private async rescheduleSeriesFrom(
    tenantId: string,
    anchor: { id: string; slot: TimeSlotVO; recurrenceSeriesId: string | null; providerId: string },
    seriesId: string,
    newStartIso: string,
    newEndIso: string,
  ): Promise<boolean> {
    const deltaMs = new Date(newStartIso).getTime() - new Date(anchor.slot.start).getTime();
    const durationMs = new Date(newEndIso).getTime() - new Date(newStartIso).getTime();
    const anchorStart = new Date(anchor.slot.start).getTime();

    const { items } = await this.repo.list({
      tenantId,
      from: anchor.slot.start,
      limit: 200,
      offset: 0,
    });

    const peers = items
      .filter(
        (item) =>
          item.recurrenceSeriesId === seriesId &&
          new Date(item.start).getTime() >= anchorStart &&
          item.status !== 'cancelled',
      )
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    for (const item of peers) {
      const peer = await this.repo.findById(item.id, tenantId);
      if (!peer) continue;

      const peerStart = new Date(new Date(peer.slot.start).getTime() + deltaMs);
      const peerEnd = new Date(peerStart.getTime() + durationMs);
      const slot = new TimeSlotVO(peerStart.toISOString(), peerEnd.toISOString());

      const conflict = await this.repo.findByProviderAndSlot(
        peer.providerId,
        slot,
        tenantId,
        peer.id,
      );
      if (conflict) {
        throw new ConflictException(
          `Series conflict for visit on ${peerStart.toISOString().slice(0, 16)}`,
        );
      }

      peer.reschedule(slot);
      await this.repo.save(peer);
    }

    return peers.length > 0;
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
  ) {}

  async execute(input: { appointmentIds: string[]; shiftDays: number }) {
    if (!input.appointmentIds?.length) {
      throw new BadRequestException('appointmentIds is required');
    }
    if (input.shiftDays === 0) {
      throw new BadRequestException('shiftDays must not be zero');
    }

    const tenant = await this.tenantContext.resolve();
    const updated: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

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

      const start = new Date(appointment.slot.start);
      const end = new Date(appointment.slot.end);
      start.setDate(start.getDate() + input.shiftDays);
      end.setDate(end.getDate() + input.shiftDays);
      const slot = new TimeSlotVO(start.toISOString(), end.toISOString());

      const providerConflict = await this.repo.findByProviderAndSlot(
        appointment.providerId,
        slot,
        tenant.tenantId,
        appointment.id,
      );
      if (providerConflict) {
        failed.push({ id, reason: 'provider_conflict' });
        continue;
      }
      if (appointment.resourceId) {
        const resourceConflict = await this.repo.findByResourceAndSlot(
          appointment.resourceId,
          slot,
          tenant.tenantId,
          appointment.id,
        );
        if (resourceConflict) {
          failed.push({ id, reason: 'resource_conflict' });
          continue;
        }
      }

      appointment.reschedule(slot);
      await this.repo.save(appointment);
      updated.push(id);
    }

    return { updated, failed, shiftDays: input.shiftDays };
  }
}

@Injectable()
export class DeleteAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const deleted = await this.repo.softDelete(id, tenant.tenantId);
    if (!deleted) throw new NotFoundException('Appointment not found');
    return { id, deleted: true };
  }
}
