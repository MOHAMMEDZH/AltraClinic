import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { APPOINTMENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Inject } from '@nestjs/common';
import { AppointmentRepository } from '../../domain/appointment.repository.interface';
import { ScheduleWindowService } from '../services/schedule-window.service';
import { TenantTimezoneService } from '../services/tenant-timezone.service';
import { AvailabilityExceptionQueryService } from '../services/availability-exception-query.service';
import {
  buildProviderAvailabilitySlots,
} from '../services/availability-slot-builder';
import {
  applyWindowToZonedDay,
  dayOfWeekInTimezone,
  zonedDayBoundsUtc,
} from '../../domain/scheduling-timezone.util';
import {
  ProviderEligibilityService,
  SCHEDULING_PROVIDER_ROLES,
} from '../services/provider-eligibility.service';
import { SCHEDULING_SERVICE_TYPES } from '../../domain/service-types';

const PROVIDER_ROLES: UserRole[] = SCHEDULING_PROVIDER_ROLES;

@Injectable()
export class ListProvidersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly eligibility: ProviderEligibilityService,
  ) {}

  async execute(branchId?: string, clinicalServiceId?: string) {
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

    let providerIds = users.map((u) => u.id);
    if (clinicalServiceId?.trim()) {
      providerIds = await this.eligibility.filterEligibleProviderIds({
        tenantId: tenant.tenantId,
        clinicalServiceId: clinicalServiceId.trim(),
        branchId: branchId ?? tenant.branchId ?? null,
        providerIds,
      });
    }
    const allowed = new Set(providerIds);

    return {
      items: users
        .filter((u) => allowed.has(u.id))
        .map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          branchId: u.branchId,
        })),
    };
  }
}

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
    private readonly eligibility: ProviderEligibilityService,
    private readonly availabilityExceptions: AvailabilityExceptionQueryService,
  ) {}

  async execute(input: {
    providerId: string;
    date: string;
    durationMin?: number;
    branchId?: string;
    clinicalServiceId?: string;
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

    const branchId = input.branchId ?? tenant.branchId ?? null;
    const clinicalServiceId = input.clinicalServiceId?.trim() || null;
    const enforcementOn = clinicalServiceId
      ? await this.eligibility.isEnforcementEnabled(tenant.tenantId)
      : false;

    const dayOfWeek = dayOfWeekInTimezone(input.date, timezone);
    const window = await this.scheduleWindow.resolveProviderWindow(
      tenant.tenantId,
      input.providerId,
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
      branchId: branchId ?? undefined,
      providerId: input.providerId,
      from: dayBounds.start.toISOString(),
      to: dayBounds.end.toISOString(),
      limit: 200,
      offset: 0,
    });

    const busy = booked
      .filter((a) => a.status !== 'cancelled')
      .map((a) => ({ start: new Date(a.start), end: new Date(a.end) }));

    let slots = buildProviderAvailabilitySlots({
      weekly: weeklyRange,
      exceptions,
      providerId: input.providerId,
      branchId,
      durationMin,
      busy,
    });

    if (enforcementOn && clinicalServiceId) {
      const filtered: typeof slots = [];
      for (const slot of slots) {
        const ok = await this.eligibility.hasActiveEligibility({
          tenantId: tenant.tenantId,
          providerUserId: input.providerId,
          clinicalServiceId,
          branchId,
          at: new Date(slot.start),
        });
        if (ok) filtered.push(slot);
      }
      slots = filtered;
    }

    return {
      providerId: input.providerId,
      date: input.date,
      durationMin,
      ...(clinicalServiceId ? { clinicalServiceId } : {}),
      slots,
      ...(enforcementOn && clinicalServiceId && slots.length === 0 ? { ineligible: true } : {}),
    };
  }
}
