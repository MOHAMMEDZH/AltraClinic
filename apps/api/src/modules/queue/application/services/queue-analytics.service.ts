import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { QueueBoardService } from './queue-board.service';
import type {
  QueueAnalyticsResponse,
  QueueHourlyThroughput,
  QueuePeakHour,
  QueueProviderUtilization,
  QueueRoomUtilization,
} from '../../domain/queue-analytics.types';

@Injectable()
export class QueueAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly board: QueueBoardService,
  ) {}

  async getAnalytics(
    tenantId: string,
    branchId: string | null | undefined,
    from?: Date,
    to?: Date,
  ): Promise<QueueAnalyticsResponse> {
    const scope = branchId ?? null;
    const rangeStart = from ?? this.startOfToday();
    const rangeEnd = to ?? new Date();
    const branchFilter = scope ? { branchId: scope } : {};

    const metrics = await this.board.getMetrics(tenantId, scope);
    const transferredToday = await this.prisma.queueTicket.count({
      where: {
        tenantId,
        status: 'TRANSFERRED',
        completedAt: { gte: this.startOfToday(), ...branchFilter },
      },
    });

    const terminalToday =
      metrics.completedToday + metrics.skippedToday + metrics.noShowToday + metrics.cancelledToday;
    const noShowRate =
      terminalToday > 0 ? Math.round((metrics.noShowToday / terminalToday) * 100) : 0;
    const completionRate =
      terminalToday > 0 ? Math.round((metrics.completedToday / terminalToday) * 100) : 0;

    const completedRows = await this.prisma.queueTicket.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: rangeStart, lte: rangeEnd },
        ...branchFilter,
        waitTimeSeconds: { not: null },
      },
      select: { completedAt: true, waitTimeSeconds: true, providerId: true },
    });

    const checkInRows = await this.prisma.queueTicket.findMany({
      where: {
        tenantId,
        checkedInAt: { gte: rangeStart, lte: rangeEnd },
        ...branchFilter,
      },
      select: { checkedInAt: true },
    });

    const hourlyMap = new Map<string, { completed: number; waitTotal: number; checkIns: number }>();
    for (const row of completedRows) {
      if (!row.completedAt) continue;
      const hour = `${row.completedAt.getHours().toString().padStart(2, '0')}:00`;
      const bucket = hourlyMap.get(hour) ?? { completed: 0, waitTotal: 0, checkIns: 0 };
      bucket.completed += 1;
      bucket.waitTotal += row.waitTimeSeconds ?? 0;
      hourlyMap.set(hour, bucket);
    }
    for (const row of checkInRows) {
      if (!row.checkedInAt) continue;
      const hour = `${row.checkedInAt.getHours().toString().padStart(2, '0')}:00`;
      const bucket = hourlyMap.get(hour) ?? { completed: 0, waitTotal: 0, checkIns: 0 };
      bucket.checkIns += 1;
      hourlyMap.set(hour, bucket);
    }

    const hourlyThroughput: QueueHourlyThroughput[] = Array.from({ length: 24 }, (_, h) => {
      const hour = `${h.toString().padStart(2, '0')}:00`;
      const bucket = hourlyMap.get(hour);
      return {
        hour,
        completed: bucket?.completed ?? 0,
        checkIns: bucket?.checkIns ?? 0,
        avgWaitMinutes: bucket?.completed
          ? Math.round(bucket.waitTotal / bucket.completed / 60)
          : 0,
      };
    }).filter((b) => b.completed > 0 || b.checkIns > 0);

    const peakHours: QueuePeakHour[] = [...hourlyThroughput]
      .map((b) => ({
        hour: b.hour,
        totalActivity: b.completed + b.checkIns,
        completed: b.completed,
        checkIns: b.checkIns,
      }))
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 5);

    const activeTickets = await this.prisma.queueTicket.findMany({
      where: {
        tenantId,
        status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        ...branchFilter,
      },
      select: { providerId: true, status: true },
    });

    const completedByProvider = await this.prisma.queueTicket.groupBy({
      by: ['providerId'],
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: this.startOfToday(), ...branchFilter },
      },
      _count: { id: true },
      _avg: { waitTimeSeconds: true },
    });

    const providerIds = [
      ...new Set([
        ...activeTickets.map((t) => t.providerId),
        ...completedByProvider.map((g) => g.providerId),
      ]),
    ];

    const providers = providerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: providerIds }, tenantId },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    const providerName = (id: string) => {
      const u = providers.find((p) => p.id === id);
      return u ? `${u.firstName} ${u.lastName}`.trim() : 'Provider';
    };

    const providerUtilization: QueueProviderUtilization[] = providerIds.map((providerId) => {
      const waiting = activeTickets.filter(
        (t) => t.providerId === providerId && t.status === 'WAITING',
      ).length;
      const called = activeTickets.filter(
        (t) => t.providerId === providerId && t.status === 'CALLED',
      ).length;
      const serving = activeTickets.filter(
        (t) => t.providerId === providerId && t.status === 'SERVING',
      ).length;
      const completedGroup = completedByProvider.find((g) => g.providerId === providerId);
      const completedToday = completedGroup?._count.id ?? 0;
      const avgWaitMinutes = completedGroup?._avg.waitTimeSeconds
        ? Math.round(completedGroup._avg.waitTimeSeconds / 60)
        : 0;
      const activeLoad = waiting + called + serving;
      const utilizationPercent =
        activeLoad + completedToday > 0
          ? Math.min(100, Math.round(((serving + completedToday) / (activeLoad + completedToday)) * 100))
          : 0;

      return {
        providerId,
        providerName: providerName(providerId),
        waiting,
        called,
        serving,
        completedToday,
        avgWaitMinutes,
        utilizationPercent,
      };
    });

    const roomRows = await this.prisma.queueTicket.groupBy({
      by: ['resourceId'],
      where: {
        tenantId,
        resourceId: { not: null },
        updatedAt: { gte: this.startOfToday() },
        ...branchFilter,
      },
      _count: { id: true },
    });

    const resourceIds = roomRows
      .map((r) => r.resourceId)
      .filter((id): id is string => id !== null);

    const resources = resourceIds.length
      ? await this.prisma.schedulingResource.findMany({
          where: { tenantId, id: { in: resourceIds } },
          select: { id: true, name: true },
        })
      : [];

    const activeByRoom = await this.prisma.queueTicket.groupBy({
      by: ['resourceId'],
      where: {
        tenantId,
        resourceId: { not: null },
        status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        ...branchFilter,
      },
      _count: { id: true },
    });

    const roomUtilization: QueueRoomUtilization[] = resources.map((resource) => {
      const completedToday = roomRows.find((r) => r.resourceId === resource.id)?._count.id ?? 0;
      const activeTickets =
        activeByRoom.find((r) => r.resourceId === resource.id)?._count.id ?? 0;
      return {
        resourceId: resource.id,
        resourceName: resource.name,
        activeTickets,
        completedToday,
      };
    });

    return {
      summary: {
        ...metrics,
        transferredToday,
        noShowRate,
        completionRate,
      },
      hourlyThroughput,
      providerUtilization: providerUtilization.sort((a, b) => b.utilizationPercent - a.utilizationPercent),
      peakHours,
      roomUtilization,
    };
  }

  async exportCsv(tenantId: string, branchId: string | null | undefined): Promise<string> {
    const scope = branchId ?? null;
    const branchFilter = scope ? { branchId: scope } : {};
    const todayStart = this.startOfToday();

    const rows = await this.prisma.queueTicket.findMany({
      where: { tenantId, ...branchFilter, updatedAt: { gte: todayStart } },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const header = [
      'ticket_id',
      'patient',
      'status',
      'priority',
      'position',
      'checked_in',
      'called_at',
      'served_at',
      'completed_at',
      'wait_minutes',
    ].join(',');

    const lines = rows.map((r) => {
      const waitMin = r.waitTimeSeconds ? Math.round(r.waitTimeSeconds / 60) : '';
      const patient = `${r.patient.firstName} ${r.patient.lastName}`.trim().replace(/,/g, ' ');
      return [
        r.id,
        `"${patient}"`,
        r.status,
        r.priority,
        '',
        r.checkedInAt?.toISOString() ?? '',
        r.calledAt?.toISOString() ?? '',
        r.servedAt?.toISOString() ?? '',
        r.completedAt?.toISOString() ?? '',
        waitMin,
      ].join(',');
    });

    return [header, ...lines].join('\n');
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
