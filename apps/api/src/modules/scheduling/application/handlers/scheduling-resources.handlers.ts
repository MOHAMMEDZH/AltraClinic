import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingResourceType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { ScheduleWindowService } from '../services/schedule-window.service';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import { AvailabilityExceptionQueryService } from '../services/availability-exception-query.service';
import { buildResourceAvailabilitySlots } from '../services/availability-slot-builder';
import {
  applyWindowToZonedDay,
  dayOfWeekInTimezone,
  zonedDayBoundsUtc,
} from '../../domain/scheduling-timezone.util';
import { SCHEDULING_AUDIT_LOG, SchedulingAuditLog } from '../ports/scheduling-audit-log.port';

const WORKDAY_START_HOUR = 7;
const WORKDAY_END_HOUR = 20;

@Injectable()
export class ListSchedulingResourcesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string, resourceType?: string) {
    const tenant = await this.tenantContext.resolve();
    const typeFilter =
      resourceType === 'room'
        ? SchedulingResourceType.ROOM
        : resourceType === 'equipment'
          ? SchedulingResourceType.EQUIPMENT
          : resourceType === 'operatory'
            ? SchedulingResourceType.OPERATORY
            : undefined;

    const rows = await this.prisma.schedulingResource.findMany({
      where: {
        tenantId: tenant.tenantId,
        deletedAt: null,
        isActive: true,
        ...(branchId ?? tenant.branchId ? { branchId: branchId ?? tenant.branchId } : {}),
        ...(typeFilter ? { resourceType: typeFilter } : {}),
      },
      orderBy: [{ resourceType: 'asc' }, { name: 'asc' }],
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        branchId: row.branchId,
        resourceType: row.resourceType.toLowerCase(),
      })),
    };
  }
}

@Injectable()
export class GetResourceAvailabilityHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly scheduleWindow: ScheduleWindowService,
    private readonly tenantTimezone: TenantTimezoneService,
    private readonly availabilityExceptions: AvailabilityExceptionQueryService,
  ) {}

  async execute(input: { resourceId: string; date: string; durationMin?: number }) {
    if (!input.resourceId?.trim()) throw new BadRequestException('resourceId is required');
    if (!input.date?.trim()) throw new BadRequestException('date is required (YYYY-MM-DD)');

    const tenant = await this.tenantContext.resolve();
    const timezone = await this.tenantTimezone.resolve();
    const durationMin = Math.min(Math.max(input.durationMin ?? 30, 5), 480);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException('Invalid date');
    }

    const resource = await this.prisma.schedulingResource.findFirst({
      where: {
        id: input.resourceId,
        tenantId: tenant.tenantId,
        deletedAt: null,
      },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const branchId = resource.branchId ?? tenant.branchId ?? null;
    const dayOfWeek = dayOfWeekInTimezone(input.date, timezone);
    const window = await this.scheduleWindow.resolveBranchWindow(
      tenant.tenantId,
      branchId,
      dayOfWeek,
    );
    const weekly = applyWindowToZonedDay(input.date, timezone, window);
    const weeklyRange = weekly
      ? { start: weekly.rangeStart, end: weekly.rangeEnd }
      : null;

    const exceptions = await this.availabilityExceptions.listOverlappingDay({
      tenantId: tenant.tenantId,
      dateYmd: input.date,
      timezone,
      branchId,
    });

    const dayBounds = zonedDayBoundsUtc(input.date, timezone);
    const { items: booked } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: branchId ?? tenant.branchId,
      from: dayBounds.start.toISOString(),
      to: dayBounds.end.toISOString(),
      limit: 200,
      offset: 0,
    });

    const busyAppts = booked.filter(
      (a) => a.resourceId === input.resourceId && a.status !== 'cancelled',
    );
    const busy = busyAppts.map((a) => ({
      start: new Date(a.start),
      end: new Date(a.end),
    }));

    const slots = buildResourceAvailabilitySlots({
      weekly: weeklyRange,
      exceptions,
      resourceId: input.resourceId,
      branchId,
      durationMin,
      busy,
    });

    return {
      resourceId: input.resourceId,
      date: input.date,
      durationMin,
      slots,
      bookedCount: busyAppts.length,
    };
  }
}

@Injectable()
export class GetResourceDayStatusHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantTimezone: TenantTimezoneService,
  ) {}

  async execute(date: string, branchId?: string) {
    const tenant = await this.tenantContext.resolve();
    const timezone = await this.tenantTimezone.resolve();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date');
    const { start: rangeStart, end: rangeEnd } = zonedDayBoundsUtc(date, timezone);

    const resources = await this.prisma.schedulingResource.findMany({
      where: {
        tenantId: tenant.tenantId,
        deletedAt: null,
        isActive: true,
        ...(branchId ?? tenant.branchId ? { branchId: branchId ?? tenant.branchId } : {}),
      },
      orderBy: [{ resourceType: 'asc' }, { name: 'asc' }],
    });

    const { items } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: branchId ?? tenant.branchId,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      limit: 500,
      offset: 0,
    });

    const active = items.filter((a) => a.status !== 'cancelled');

    return {
      date,
      items: resources.map((resource) => {
        const bookings = active.filter((a) => a.resourceId === resource.id);
        return {
          id: resource.id,
          name: resource.name,
          resourceType: resource.resourceType.toLowerCase(),
          bookingCount: bookings.length,
          available: bookings.length === 0,
        };
      }),
    };
  }
}

@Injectable()
export class CreateSchedulingResourceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: {
    name: string;
    resourceType: 'ROOM' | 'EQUIPMENT' | 'OPERATORY';
    branchId?: string | null;
    displaySubtype?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const type =
      input.resourceType === 'ROOM'
        ? SchedulingResourceType.ROOM
        : input.resourceType === 'EQUIPMENT'
          ? SchedulingResourceType.EQUIPMENT
          : input.resourceType === 'OPERATORY'
            ? SchedulingResourceType.OPERATORY
            : null;
    if (!type) throw new BadRequestException('resourceType must be ROOM, EQUIPMENT, or OPERATORY');

    return this.prisma.withPlatformBypass(async (tx) => {
        let branchId = input.branchId ?? tenant.branchId ?? null;
        if (branchId) {
          const branch = await tx.branch.findFirst({
            where: { id: branchId, tenantId: tenant.tenantId, deletedAt: null },
            select: { id: true },
          });
          if (!branch) throw new BadRequestException('branchId does not belong to the current tenant');
          branchId = branch.id;
        }
        const row = await tx.schedulingResource.create({
          data: {
            id: randomUUID(),
            tenantId: tenant.tenantId,
            branchId,
            name,
            resourceType: type,
            displaySubtype: input.displaySubtype?.trim() || null,
            isActive: true,
          },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId: tenant.tenantId,
          action: 'scheduling.resource.create',
          resourceId: row.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: `Created ${type} resource ${name}`,
          descriptionAr: `تم إنشاء مورد ${type} ${name}`,
          details: { resourceType: type, branchId },
        });
        return {
          id: row.id,
          name: row.name,
          branchId: row.branchId,
          resourceType: row.resourceType.toLowerCase(),
          displaySubtype: row.displaySubtype,
        };
    });
  }
}
