import { Injectable } from '@nestjs/common';
import { AppointmentStatus as PrismaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentRepository } from '../domain/appointment.repository.interface';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';
import type { AppointmentDetail, AppointmentListFilter, AppointmentListItem } from '../domain/scheduling.types';

const DOMAIN_TO_PRISMA: Record<AppointmentStatus, PrismaStatus> = {
  [AppointmentStatus.Pending]: PrismaStatus.PENDING,
  [AppointmentStatus.Confirmed]: PrismaStatus.CONFIRMED,
  [AppointmentStatus.CheckedIn]: PrismaStatus.CHECKED_IN,
  [AppointmentStatus.InProgress]: PrismaStatus.IN_PROGRESS,
  [AppointmentStatus.Cancelled]: PrismaStatus.CANCELLED,
  [AppointmentStatus.Completed]: PrismaStatus.COMPLETED,
  [AppointmentStatus.NoShow]: PrismaStatus.NO_SHOW,
};

const PRISMA_TO_DOMAIN: Partial<Record<PrismaStatus, AppointmentStatus>> = {
  PENDING: AppointmentStatus.Pending,
  CONFIRMED: AppointmentStatus.Confirmed,
  CHECKED_IN: AppointmentStatus.CheckedIn,
  IN_PROGRESS: AppointmentStatus.InProgress,
  CANCELLED: AppointmentStatus.Cancelled,
  COMPLETED: AppointmentStatus.Completed,
  NO_SHOW: AppointmentStatus.NoShow,
};

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(appointment: Appointment): Promise<void> {
    await this.prisma.appointment.upsert({
      where: { id: appointment.id },
      create: {
        id: appointment.id,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledStart: new Date(appointment.slot.start),
        scheduledEnd: new Date(appointment.slot.end),
        status: DOMAIN_TO_PRISMA[appointment.status],
        notes: appointment.notes,
        cancellationReason: appointment.cancellationReason,
        serviceType: appointment.serviceType,
        isEmergency: appointment.isEmergency,
        recurrenceSeriesId: appointment.recurrenceSeriesId,
        resourceId: appointment.resourceId,
        createdAt: appointment.createdAt,
      },
      update: {
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledStart: new Date(appointment.slot.start),
        scheduledEnd: new Date(appointment.slot.end),
        status: DOMAIN_TO_PRISMA[appointment.status],
        notes: appointment.notes,
        cancellationReason: appointment.cancellationReason,
        serviceType: appointment.serviceType,
        isEmergency: appointment.isEmergency,
        recurrenceSeriesId: appointment.recurrenceSeriesId,
        resourceId: appointment.resourceId,
        updatedAt: appointment.updatedAt ?? new Date(),
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findDetailById(id: string, tenantId: string): Promise<AppointmentDetail | null> {
    const row = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
    return row ? { ...this.toListItem(row, null), updatedAt: row.updatedAt.toISOString(), cancellationReason: row.cancellationReason } : null;
  }

  async findByProviderAndSlot(
    providerId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        providerId,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        scheduledStart: { lt: new Date(slot.end) },
        scheduledEnd: { gt: new Date(slot.start) },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByResourceAndSlot(
    resourceId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        resourceId,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        scheduledStart: { lt: new Date(slot.end) },
        scheduledEnd: { gt: new Date(slot.start) },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: AppointmentListFilter): Promise<{ items: AppointmentListItem[]; total: number }> {
    const where: Prisma.AppointmentWhereInput = {
      tenantId: filter.tenantId,
      deletedAt: null,
    };

    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.providerId) where.providerId = filter.providerId;
    if (filter.patientId) where.patientId = filter.patientId;
    if (filter.status) {
      const statusMap: Record<string, PrismaStatus> = {
        pending: 'PENDING',
        confirmed: 'CONFIRMED',
        cancelled: 'CANCELLED',
        completed: 'COMPLETED',
        no_show: 'NO_SHOW',
      };
      const prismaStatus = statusMap[filter.status];
      if (prismaStatus) where.status = prismaStatus;
    }
    if (filter.from || filter.to) {
      where.scheduledStart = {};
      if (filter.from) where.scheduledStart.gte = new Date(filter.from);
      if (filter.to) where.scheduledStart.lte = new Date(filter.to);
    }
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { notes: { contains: q, mode: 'insensitive' } },
        { patient: { firstName: { contains: q, mode: 'insensitive' } } },
        { patient: { lastName: { contains: q, mode: 'insensitive' } } },
        { patient: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { scheduledStart: 'asc' },
        skip: filter.offset,
        take: filter.limit,
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    const resourceIds = [
      ...new Set(rows.map((r) => r.resourceId).filter((id): id is string => Boolean(id))),
    ];
    const resources =
      resourceIds.length > 0
        ? await this.prisma.schedulingResource.findMany({
            where: { id: { in: resourceIds }, tenantId: filter.tenantId },
            select: { id: true, name: true },
          })
        : [];
    const resourceNames = new Map(resources.map((r) => [r.id, r.name]));

    return {
      total,
      items: rows.map((r) => this.toListItem(r, resourceNames.get(r.resourceId ?? '') ?? null)),
    };
  }

  async listSeriesFutureMembers(params: {
    tenantId: string;
    recurrenceSeriesId: string;
    fromScheduledStart: string | Date;
    pageSize?: number;
  }): Promise<AppointmentListItem[]> {
    const from = new Date(params.fromScheduledStart);
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : undefined;
    const collected: AppointmentListItem[] = [];
    let cursorStart: Date | null = null;
    let cursorId: string | null = null;

    for (;;) {
      const where: Prisma.AppointmentWhereInput = {
        tenantId: params.tenantId,
        recurrenceSeriesId: params.recurrenceSeriesId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        ...(cursorId
          ? {
              OR: [
                { scheduledStart: { gt: cursorStart! } },
                { scheduledStart: cursorStart!, id: { gt: cursorId } },
              ],
            }
          : { scheduledStart: { gte: from } }),
      };
      const rows = await this.prisma.appointment.findMany({
        where,
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
        ...(pageSize ? { take: pageSize } : {}),
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      if (rows.length === 0) break;

      const resourceIds = [
        ...new Set(rows.map((r) => r.resourceId).filter((id): id is string => Boolean(id))),
      ];
      const resources =
        resourceIds.length > 0
          ? await this.prisma.schedulingResource.findMany({
              where: { id: { in: resourceIds }, tenantId: params.tenantId },
              select: { id: true, name: true },
            })
          : [];
      const resourceNames = new Map(resources.map((r) => [r.id, r.name]));
      for (const r of rows) {
        collected.push(this.toListItem(r, resourceNames.get(r.resourceId ?? '') ?? null));
      }

      if (!pageSize || rows.length < pageSize) break;
      const last = rows[rows.length - 1]!;
      cursorStart = last.scheduledStart;
      cursorId = last.id;
    }

    return collected;
  }

  async updateNotes(id: string, tenantId: string, notes: string | null): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: { id, tenantId },
      data: { notes },
    });
  }

  async softDelete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.appointment.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }

  private toListItem(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    providerId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: PrismaStatus;
    notes: string | null;
    cancellationReason?: string | null;
    serviceType?: string | null;
    isEmergency?: boolean;
    recurrenceSeriesId?: string | null;
    resourceId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    patient?: { firstName: string; lastName: string };
  }, resourceName?: string | null): AppointmentListItem {
    const domainStatus = PRISMA_TO_DOMAIN[row.status] ?? AppointmentStatus.Pending;
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      patientId: row.patientId,
      patientName: row.patient
        ? `${row.patient.firstName} ${row.patient.lastName}`.trim()
        : row.patientId,
      providerId: row.providerId,
      start: row.scheduledStart.toISOString(),
      end: row.scheduledEnd.toISOString(),
      status: domainStatus,
      notes: row.notes,
      serviceType: row.serviceType ?? null,
      isEmergency: row.isEmergency ?? false,
      recurrenceSeriesId: row.recurrenceSeriesId ?? null,
      resourceId: row.resourceId ?? null,
      resourceName: resourceName ?? null,
      createdAt: row.createdAt,
    };
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    providerId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: PrismaStatus;
    notes: string | null;
    cancellationReason?: string | null;
    serviceType?: string | null;
    isEmergency?: boolean;
    recurrenceSeriesId?: string | null;
    resourceId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Appointment {
    const appt = new Appointment(
      row.id,
      row.tenantId,
      row.branchId,
      row.patientId,
      row.providerId,
      new TimeSlotVO(row.scheduledStart.toISOString(), row.scheduledEnd.toISOString()),
      PRISMA_TO_DOMAIN[row.status] ?? AppointmentStatus.Pending,
      row.createdAt,
      row.notes,
      row.cancellationReason ?? null,
      row.serviceType ?? null,
      row.isEmergency ?? false,
      row.recurrenceSeriesId ?? null,
      row.resourceId ?? null,
    );
    appt.updatedAt = row.updatedAt;
    return appt;
  }
}
