import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface DayWindow {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  isClosed: boolean;
}

export const DEFAULT_DAY_WINDOW: DayWindow = {
  startHour: 7,
  startMin: 0,
  endHour: 20,
  endMin: 0,
  isClosed: false,
};

function toMinutes(hour: number, min: number): number {
  return hour * 60 + min;
}

@Injectable()
export class ScheduleWindowService {
  constructor(private readonly prisma: PrismaService) { }

  async resolveProviderWindow(
    tenantId: string,
    providerId: string,
    branchId: string | null | undefined,
    dayOfWeek: number,
  ): Promise<DayWindow> {

    const branchHours =
      branchId != null
        ? await this.prisma.branchOperatingHours.findUnique({
            where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
          })
        : null;

    if (branchHours?.isClosed) {
      return { ...DEFAULT_DAY_WINDOW, isClosed: true };
    }

    const providerHours = await this.prisma.providerWeeklySchedule.findUnique({
      where: {
        tenantId_providerId_dayOfWeek: { tenantId, providerId, dayOfWeek },
      },
    });

    if (providerHours?.isOff) {
      return { ...DEFAULT_DAY_WINDOW, isClosed: true };
    }

    let startHour = branchHours?.openHour ?? DEFAULT_DAY_WINDOW.startHour;
    let startMin = branchHours?.openMin ?? DEFAULT_DAY_WINDOW.startMin;
    let endHour = branchHours?.closeHour ?? DEFAULT_DAY_WINDOW.endHour;
    let endMin = branchHours?.closeMin ?? DEFAULT_DAY_WINDOW.endMin;

    if (providerHours) {
      startHour = providerHours.startHour;
      startMin = providerHours.startMin;
      endHour = providerHours.endHour;
      endMin = providerHours.endMin;

      if (branchHours && !branchHours.isClosed) {
        const branchStart = toMinutes(branchHours.openHour, branchHours.openMin);
        const branchEnd = toMinutes(branchHours.closeHour, branchHours.closeMin);
        const providerStart = toMinutes(providerHours.startHour, providerHours.startMin);
        const providerEnd = toMinutes(providerHours.endHour, providerHours.endMin);
        const start = Math.max(branchStart, providerStart);
        const end = Math.min(branchEnd, providerEnd);
        if (start >= end) {
          return { ...DEFAULT_DAY_WINDOW, isClosed: true };
        }
        startHour = Math.floor(start / 60);
        startMin = start % 60;
        endHour = Math.floor(end / 60);
        endMin = end % 60;
      }
    }

    return { startHour, startMin, endHour, endMin, isClosed: false };
  }

  async resolveBranchWindow(
    tenantId: string,
    branchId: string | null | undefined,
    dayOfWeek: number,
  ): Promise<DayWindow> {
    if (!branchId) return DEFAULT_DAY_WINDOW;

    const branchHours = await this.prisma.branchOperatingHours.findUnique({
      where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
    });

    if (!branchHours || branchHours.isClosed) {
      return { ...DEFAULT_DAY_WINDOW, isClosed: !branchHours ? false : true };
    }

    return {
      startHour: branchHours.openHour,
      startMin: branchHours.openMin,
      endHour: branchHours.closeHour,
      endMin: branchHours.closeMin,
      isClosed: false,
    };
  }

  applyWindowToDay(date: Date, window: DayWindow): { rangeStart: Date; rangeEnd: Date } | null {
    if (window.isClosed) return null;

    const rangeStart = new Date(date);
    rangeStart.setHours(window.startHour, window.startMin, 0, 0);

    const rangeEnd = new Date(date);
    rangeEnd.setHours(window.endHour, window.endMin, 0, 0);

    if (rangeStart.getTime() >= rangeEnd.getTime()) return null;
    return { rangeStart, rangeEnd };
  }
}
