import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

export interface BranchHoursDayInput {
  dayOfWeek: number;
  openHour: number;
  openMin?: number;
  closeHour: number;
  closeMin?: number;
  isClosed?: boolean;
}

@Injectable()
export class GetBranchHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(branchId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.branchOperatingHours.findMany({
      where: { tenantId: tenant.tenantId, branchId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return {
      branchId,
      items: rows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        openHour: row.openHour,
        openMin: row.openMin,
        closeHour: row.closeHour,
        closeMin: row.closeMin,
        isClosed: row.isClosed,
      })),
    };
  }
}

@Injectable()
export class UpsertBranchHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(branchId: string, days: BranchHoursDayInput[]) {
    if (!branchId?.trim()) throw new BadRequestException('branchId is required');
    if (!Array.isArray(days) || days.length === 0) {
      throw new BadRequestException('days array is required');
    }

    const tenant = await this.tenantContext.resolve();

    for (const day of days) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be 0–6');
      }
      await this.prisma.branchOperatingHours.upsert({
        where: { branchId_dayOfWeek: { branchId, dayOfWeek: day.dayOfWeek } },
        create: {
          tenantId: tenant.tenantId,
          branchId,
          dayOfWeek: day.dayOfWeek,
          openHour: day.openHour,
          openMin: day.openMin ?? 0,
          closeHour: day.closeHour,
          closeMin: day.closeMin ?? 0,
          isClosed: day.isClosed ?? false,
        },
        update: {
          openHour: day.openHour,
          openMin: day.openMin ?? 0,
          closeHour: day.closeHour,
          closeMin: day.closeMin ?? 0,
          isClosed: day.isClosed ?? false,
          updatedAt: new Date(),
        },
      });
    }

    return { branchId, updated: days.length };
  }
}

export interface ProviderScheduleDayInput {
  dayOfWeek: number;
  startHour: number;
  startMin?: number;
  endHour: number;
  endMin?: number;
  isOff?: boolean;
}

@Injectable()
export class GetProviderScheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(providerId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.providerWeeklySchedule.findMany({
      where: { tenantId: tenant.tenantId, providerId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return {
      providerId,
      items: rows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startHour: row.startHour,
        startMin: row.startMin,
        endHour: row.endHour,
        endMin: row.endMin,
        isOff: row.isOff,
      })),
    };
  }
}

@Injectable()
export class UpsertProviderScheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(providerId: string, days: ProviderScheduleDayInput[]) {
    if (!providerId?.trim()) throw new BadRequestException('providerId is required');
    if (!Array.isArray(days) || days.length === 0) {
      throw new BadRequestException('days array is required');
    }

    const tenant = await this.tenantContext.resolve();

    for (const day of days) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be 0–6');
      }
      await this.prisma.providerWeeklySchedule.upsert({
        where: {
          tenantId_providerId_dayOfWeek: {
            tenantId: tenant.tenantId,
            providerId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        create: {
          tenantId: tenant.tenantId,
          branchId: tenant.branchId,
          providerId,
          dayOfWeek: day.dayOfWeek,
          startHour: day.startHour,
          startMin: day.startMin ?? 0,
          endHour: day.endHour,
          endMin: day.endMin ?? 0,
          isOff: day.isOff ?? false,
        },
        update: {
          startHour: day.startHour,
          startMin: day.startMin ?? 0,
          endHour: day.endHour,
          endMin: day.endMin ?? 0,
          isOff: day.isOff ?? false,
          updatedAt: new Date(),
        },
      });
    }

    return { providerId, updated: days.length };
  }
}

@Injectable()
export class BookWaitlistEntryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(
    waitlistId: string,
    input: { start: string; end: string; providerId?: string },
  ) {
    const tenant = await this.tenantContext.resolve();
    const entry = await this.prisma.appointmentWaitlist.findFirst({
      where: {
        id: waitlistId,
        tenantId: tenant.tenantId,
        status: 'OPEN',
        deletedAt: null,
      },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    if (!input.start?.trim() || !input.end?.trim()) {
      throw new BadRequestException('start and end are required');
    }

    const providerId = input.providerId ?? entry.providerId;
    if (!providerId) throw new BadRequestException('providerId is required');

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId: tenant.tenantId,
        branchId: entry.branchId ?? tenant.branchId,
        patientId: entry.patientId,
        providerId,
        scheduledStart: new Date(input.start),
        scheduledEnd: new Date(input.end),
        status: 'PENDING',
        notes: entry.notes,
      },
    });

    await this.prisma.appointmentWaitlist.update({
      where: { id: entry.id },
      data: { status: 'SCHEDULED', updatedAt: new Date() },
    });

    return { appointmentId: appointment.id, waitlistId: entry.id };
  }
}
