import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Inject } from '@nestjs/common';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { ScheduleWindowService } from '../services/schedule-window.service';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import {
  applyWindowToZonedDay,
  dayOfWeekInTimezone,
  zonedDayBoundsUtc,
} from '../../domain/scheduling-timezone.util';

const PROVIDER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.DOCTOR,
  UserRole.DENTIST,
  UserRole.SPECIALIST,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
];

const WORKDAY_START_HOUR = 7;
const WORKDAY_END_HOUR = 20;
const SLOT_INTERVAL_MIN = 15;

@Injectable()
export class ListProvidersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string) {
    const tenant = await this.tenantContext.resolve();
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: tenant.tenantId,
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        roles: { some: { role: { in: PROVIDER_ROLES } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branchId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return {
      items: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        branchId: u.branchId,
      })),
    };
  }
}

import { SCHEDULING_SERVICE_TYPES } from '../../domain/service-types';

@Injectable()
export class ListServiceTypesHandler {
  async execute() {
    return {
      items: SCHEDULING_SERVICE_TYPES.map((item) => ({
        id: item.id,
        defaultDurationMin: item.defaultDurationMin,
      })),
    };
  }
}

@Injectable()
export class GetAvailabilityHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: AppointmentRepository,
    private readonly tenantContext: TenantContextService,
    private readonly scheduleWindow: ScheduleWindowService,
    private readonly tenantTimezone: TenantTimezoneService,
  ) {}

  async execute(input: {
    providerId: string;
    date: string;
    durationMin?: number;
    branchId?: string;
  }) {
    if (!input.providerId?.trim()) {
      throw new BadRequestException('providerId is required');
    }
    if (!input.date?.trim()) {
      throw new BadRequestException('date is required (YYYY-MM-DD)');
    }

    const tenant = await this.tenantContext.resolve();
    const timezone = await this.tenantTimezone.resolve();
    const durationMin = Math.min(Math.max(input.durationMin ?? 30, 5), 480);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException('Invalid date');
    }

    const dayOfWeek = dayOfWeekInTimezone(input.date, timezone);
    const window = await this.scheduleWindow.resolveProviderWindow(
      tenant.tenantId,
      input.providerId,
      input.branchId ?? tenant.branchId,
      dayOfWeek,
    );
    const range = applyWindowToZonedDay(input.date, timezone, window);
    if (!range) {
      return {
        providerId: input.providerId,
        date: input.date,
        durationMin,
        slots: [],
      };
    }

    const { rangeStart, rangeEnd } = range;

    const { items: booked } = await this.repo.list({
      tenantId: tenant.tenantId,
      branchId: input.branchId ?? tenant.branchId,
      providerId: input.providerId,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      limit: 200,
      offset: 0,
    });

    const busy = booked.filter((a) => a.status !== 'cancelled');

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
      providerId: input.providerId,
      date: input.date,
      durationMin,
      slots,
    };
  }
}
