import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingResourceType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { ScheduleWindowService } from '../services/schedule-window.service';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import {
  applyWindowToZonedDay,
  dayOfWeekInTimezone,
  zonedDayBoundsUtc,
} from '../../domain/scheduling-timezone.util';

const WORKDAY_START_HOUR = 7;
const WORKDAY_END_HOUR = 20;
const SLOT_INTERVAL_MIN = 15;

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

    const dayOfWeek = dayOfWeekInTimezone(input.date, timezone);
    const window = await this.scheduleWindow.resolveBranchWindow(
      tenant.tenantId,
      resource.branchId ?? tenant.branchId,
      dayOfWeek,
    );
    const range = applyWindowToZonedDay(input.date, timezone, window);
    if (!range) {
      return {
        resourceId: input.resourceId,
        date: input.date,
        durationMin,
        slots: [],
        bookedCount: 0,
      };
    }

    const { rangeStart, rangeEnd } = range;

    const { items: booked } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      limit: 200,
      offset: 0,
    });

    const busy = booked.filter(
      (a) => a.resourceId === input.resourceId && a.status !== 'cancelled',
    );

    const slots: Array<{ start: string; end: string }> = [];
    const cursor = new Date(rangeStart);
    while (cursor.getTime() + durationMin * 60_000 <= rangeEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMin);

      const overlaps = busy.some((appt) => {
        const aStart = new Date(appt.start).getTime();
        const aEnd = new Date(appt.end).getTime();
        return slotStart.getTime() < aEnd && slotEnd.getTime() > aStart;
      });

      if (!overlaps) {
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      }

      cursor.setMinutes(cursor.getMinutes() + SLOT_INTERVAL_MIN);
    }

    return {
      resourceId: input.resourceId,
      date: input.date,
      durationMin,
      slots,
      bookedCount: busy.length,
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
