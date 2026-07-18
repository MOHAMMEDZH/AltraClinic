import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RealtimeDashboardService } from '../../realtime/application/services/realtime-dashboard.service';
import {
  buildUtcDateSeries,
  type DashboardRange,
  resolveTrendWindow,
} from './dashboard-range';
export interface DashboardOverviewDto {
  generatedAt: string;
  live: {
    date: string;
    appointmentsToday: number;
    newPatientsToday: number;
    queueDepth: number;
    activeUsers: number;
  };
  kpis: {
    totalPatients: number;
    appointmentsToday: number;
    appointmentsPending: number;
    encountersOpen: number;
    revenueToday: number;
    revenueMonth: number;
    outstandingAmount: number;
    queueWaiting: number;
    lowStockCount: number;
  };
  revenueTrend: Array<{ date: string; amount: number }>;
  appointmentTrend: Array<{ date: string; count: number }>;
  todayAppointments: Array<{
    id: string;
    patientId: string;
    providerId: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: string;
  }>;
  queue: Array<{
    id: string;
    patientId: string;
    status: string;
    waitTimeSeconds: number | null;
    checkedInAt: string | null;
    scheduledStart: string;
  }>;
  lowStockItems: Array<{
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string | null;
    quantityOnHand: number;
    reorderThreshold: number;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
    createdAt: string;
  }>;
  patientGrowthTrend: Array<{ date: string; count: number }>;
  branchPerformance: Array<{
    branchId: string;
    name: string;
    nameAr: string | null;
    appointments: number;
    revenue: number;
  }>;
  doctorPerformance: Array<{
    providerId: string;
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    appointments: number;
    encounters: number;
  }>;
  businessHealth: {
    utilizationPercent: number;
    collectionPercent: number;
    noShowPercent: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    readAt: string | null;
    createdAt: string;
  }>;
  tasks: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    status: string;
    currentStepIndex: number;
    stepsTotal: number;
    updatedAt: string;
  }>;
  subscription: {
    plan: string;
    status: string;
    endDate: string | null;
    pricePerMonth: number;
    currency: string;
  } | null;
}

@Injectable()
export class DashboardOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeDashboard: RealtimeDashboardService,
  ) {}

  async getOverview(
    tenantId: string,
    branchId?: string | null,
    range: DashboardRange = '7d',
    userId?: string,
    customFrom?: string,
    customTo?: string,
  ): Promise<DashboardOverviewDto> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const { trendStart, trendDays } = resolveTrendWindow(startOfDay, range, customFrom, customTo);
    const branchFilter = branchId ? { branchId } : {};
    const tenantWhere = { tenantId, deletedAt: null as Date | null };

    const [
      liveSnapshot,
      totalPatients,
      appointmentsToday,
      appointmentsPending,
      encountersOpen,
      queueWaiting,
      revenueTodayAgg,
      revenueMonthAgg,
      outstandingAgg,
      lowStockItems,
      todayAppointments,
      queueTickets,
      recentActivities,
      appointmentTrendRaw,
      revenueTrendRaw,
      patientGrowthRaw,
      branchPerformanceRaw,
      doctorAppointmentsRaw,
      healthCompleted,
      healthNoShow,
      healthTotal,
      collectionMonthAgg,
      userNotifications,
      activeWorkflows,
      platformTenant,
    ] = await Promise.all([
      this.realtimeDashboard.getSnapshot(tenantId),
      this.prisma.patient.count({ where: { ...tenantWhere, ...branchFilter } }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          deletedAt: null,
          scheduledStart: { gte: startOfDay },
          ...branchFilter,
        },
      }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledStart: { gte: startOfDay },
          ...branchFilter,
        },
      }),
      this.prisma.encounter.count({
        where: {
          tenantId,
          deletedAt: null,
          followUpDate: { gte: startOfDay },
          ...branchFilter,
        },
      }),
      this.prisma.queueTicket.count({
        where: {
          tenantId,
          status: 'WAITING',
          ...branchFilter,
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          invoiceDate: { gte: startOfDay },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          ...branchFilter,
        },
        _sum: { amountPaid: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          invoiceDate: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          ...branchFilter,
        },
        _sum: { amountPaid: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'] },
          ...branchFilter,
        },
        _sum: { amountTotal: true, amountPaid: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...branchFilter,
        },
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          quantityOnHand: true,
          reorderThreshold: true,
        },
        take: 200,
      }),
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          deletedAt: null,
          scheduledStart: { gte: startOfDay },
          ...branchFilter,
        },
        orderBy: { scheduledStart: 'asc' },
        take: 12,
        select: {
          id: true,
          patientId: true,
          providerId: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
        },
      }),
      this.prisma.queueTicket.findMany({
        where: {
          tenantId,
          status: { in: ['WAITING', 'SERVING'] },
          ...branchFilter,
        },
        orderBy: { checkedInAt: 'asc' },
        take: 12,
        select: {
          id: true,
          patientId: true,
          status: true,
          waitTimeSeconds: true,
          checkedInAt: true,
          scheduledStart: true,
        },
      }),
      this.prisma.auditEntry.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          descriptionEn: true,
          descriptionAr: true,
          createdAt: true,
        },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('day', "scheduledStart") AS day, COUNT(*)::bigint AS count
          FROM appointments
          WHERE "tenantId" = ${tenantId}::uuid
            AND "deletedAt" IS NULL
            AND "scheduledStart" >= ${trendStart}
            ${branchId ? Prisma.sql`AND "branchId" = ${branchId}::uuid` : Prisma.empty}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      this.prisma.$queryRaw<Array<{ day: Date; amount: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT date_trunc('day', "invoiceDate") AS day, COALESCE(SUM("amountPaid"), 0) AS amount
          FROM invoices
          WHERE "tenantId" = ${tenantId}::uuid
            AND "deletedAt" IS NULL
            AND "invoiceDate" >= ${trendStart}
            AND status NOT IN ('CANCELLED', 'DRAFT')
            ${branchId ? Prisma.sql`AND "branchId" = ${branchId}::uuid` : Prisma.empty}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
        Prisma.sql`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
          FROM patients
          WHERE "tenantId" = ${tenantId}::uuid
            AND "deletedAt" IS NULL
            AND "createdAt" >= ${trendStart}
            ${branchId ? Prisma.sql`AND "branchId" = ${branchId}::uuid` : Prisma.empty}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      branchId
        ? Promise.resolve([] as Array<{ branchId: string; name: string; nameAr: string | null; appointments: bigint; revenue: Prisma.Decimal }>)
        : this.prisma.$queryRaw<
            Array<{
              branchId: string;
              name: string;
              nameAr: string | null;
              appointments: bigint;
              revenue: Prisma.Decimal;
            }>
          >(
            Prisma.sql`
              SELECT
                b.id AS "branchId",
                b.name,
                b."nameAr",
                COUNT(DISTINCT a.id)::bigint AS appointments,
                COALESCE(SUM(inv."amountPaid"), 0) AS revenue
              FROM branches b
              LEFT JOIN appointments a
                ON a."branchId" = b.id
                AND a."tenantId" = ${tenantId}::uuid
                AND a."deletedAt" IS NULL
                AND a."scheduledStart" >= ${trendStart}
              LEFT JOIN invoices inv
                ON inv."branchId" = b.id
                AND inv."tenantId" = ${tenantId}::uuid
                AND inv."deletedAt" IS NULL
                AND inv."invoiceDate" >= ${trendStart}
                AND inv.status NOT IN ('CANCELLED', 'DRAFT')
              WHERE b."tenantId" = ${tenantId}::uuid
                AND b."isActive" = true
              GROUP BY b.id, b.name, b."nameAr"
              ORDER BY appointments DESC
            `,
          ),
      this.prisma.$queryRaw<Array<{ providerId: string; count: bigint }>>(
        Prisma.sql`
          SELECT "providerId", COUNT(*)::bigint AS count
          FROM appointments
          WHERE "tenantId" = ${tenantId}::uuid
            AND "deletedAt" IS NULL
            AND "scheduledStart" >= ${trendStart}
            ${branchId ? Prisma.sql`AND "branchId" = ${branchId}::uuid` : Prisma.empty}
          GROUP BY "providerId"
          ORDER BY count DESC
          LIMIT 8
        `,
      ),
      this.prisma.appointment.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'COMPLETED',
          scheduledStart: { gte: trendStart },
          ...branchFilter,
        },
      }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'NO_SHOW',
          scheduledStart: { gte: trendStart },
          ...branchFilter,
        },
      }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED'] },
          scheduledStart: { gte: trendStart },
          ...branchFilter,
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          invoiceDate: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          ...branchFilter,
        },
        _sum: { amountTotal: true, amountPaid: true },
      }),
      userId
        ? this.prisma.notification.findMany({
            where: { tenantId, recipientId: userId },
            orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
            take: 6,
            select: {
              id: true,
              title: true,
              body: true,
              priority: true,
              readAt: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.workflow.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(branchId ? { branchId } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          status: true,
          currentStepIndex: true,
          steps: true,
          updatedAt: true,
        },
      }),
      this.prisma.platformTenant.findUnique({
        where: { tenantId },
        select: {
          plan: true,
          platformSubscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              endDate: true,
              pricePerMonth: true,
              currency: true,
              plan: true,
            },
          },
        },
      }),
    ]);

    const lowStock = lowStockItems.filter(
      (item) => Number(item.quantityOnHand) <= Number(item.reorderThreshold),
    );

    const outstandingTotal = Number(outstandingAgg._sum.amountTotal ?? 0);
    const outstandingPaid = Number(outstandingAgg._sum.amountPaid ?? 0);

    const providerIds = doctorAppointmentsRaw.map((row) => row.providerId);
    const [providers, encounterCounts] = await Promise.all([
      providerIds.length
        ? this.prisma.user.findMany({
            where: { tenantId, id: { in: providerIds }, deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
            },
          })
        : Promise.resolve([]),
      providerIds.length
        ? this.prisma.encounter.groupBy({
            by: ['clinicianId'],
            where: {
              tenantId,
              deletedAt: null,
              clinicianId: { in: providerIds },
              createdAt: { gte: trendStart },
              ...branchFilter,
            },
            _count: { id: true },
          })
        : Promise.resolve([]),
    ]);
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const encounterMap = new Map(
      encounterCounts.map((e) => [e.clinicianId, e._count.id]),
    );

    const monthTotal = Number(collectionMonthAgg._sum.amountTotal ?? 0);
    const monthPaid = Number(collectionMonthAgg._sum.amountPaid ?? 0);
    const collectionPercent = monthTotal > 0 ? Math.round((monthPaid / monthTotal) * 100) : 100;
    const utilizationPercent =
      healthTotal > 0 ? Math.round((healthCompleted / healthTotal) * 100) : 0;
    const noShowPercent = healthTotal > 0 ? Math.round((healthNoShow / healthTotal) * 100) : 0;

    const latestSub = platformTenant?.platformSubscriptions[0];
    const subscription = platformTenant
      ? {
          plan: latestSub?.plan ?? platformTenant.plan,
          status: latestSub?.status ?? 'ACTIVE',
          endDate: latestSub?.endDate?.toISOString() ?? null,
          pricePerMonth: Number(latestSub?.pricePerMonth ?? 0),
          currency: latestSub?.currency ?? 'USD',
        }
      : null;

    return {
      generatedAt: now.toISOString(),
      live: {
        date: liveSnapshot.date,
        appointmentsToday: liveSnapshot.appointments,
        newPatientsToday: liveSnapshot.newPatients,
        queueDepth: liveSnapshot.queue.depth,
        activeUsers: liveSnapshot.activeUsers,
      },
      kpis: {
        totalPatients,
        appointmentsToday,
        appointmentsPending,
        encountersOpen,
        revenueToday: Number(revenueTodayAgg._sum.amountPaid ?? 0),
        revenueMonth: Number(revenueMonthAgg._sum.amountPaid ?? 0),
        outstandingAmount: Math.max(0, outstandingTotal - outstandingPaid),
        queueWaiting,
        lowStockCount: lowStock.length,
      },
      revenueTrend: this.fillRevenueTrend(revenueTrendRaw, trendStart, trendDays),
      appointmentTrend: this.fillAppointmentTrend(appointmentTrendRaw, trendStart, trendDays),
      patientGrowthTrend: this.fillAppointmentTrend(patientGrowthRaw, trendStart, trendDays),
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        providerId: a.providerId,
        scheduledStart: a.scheduledStart.toISOString(),
        scheduledEnd: a.scheduledEnd.toISOString(),
        status: a.status,
      })),
      queue: queueTickets.map((q) => ({
        id: q.id,
        patientId: q.patientId,
        status: q.status,
        waitTimeSeconds: q.waitTimeSeconds,
        checkedInAt: q.checkedInAt?.toISOString() ?? null,
        scheduledStart: q.scheduledStart.toISOString(),
      })),
      lowStockItems: lowStock.slice(0, 8).map((item) => ({
        id: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        quantityOnHand: Number(item.quantityOnHand),
        reorderThreshold: Number(item.reorderThreshold),
      })),
      recentActivities: recentActivities.map((entry) => ({
        id: entry.id,
        action: entry.action,
        descriptionEn: entry.descriptionEn,
        descriptionAr: entry.descriptionAr,
        createdAt: entry.createdAt.toISOString(),
      })),
      branchPerformance: branchPerformanceRaw.map((row) => ({
        branchId: row.branchId,
        name: row.name,
        nameAr: row.nameAr,
        appointments: Number(row.appointments),
        revenue: Number(row.revenue),
      })),
      doctorPerformance: doctorAppointmentsRaw.map((row) => {
        const provider = providerMap.get(row.providerId);
        return {
          providerId: row.providerId,
          firstName: provider?.firstName ?? 'Provider',
          lastName: provider?.lastName ?? row.providerId.slice(0, 8),
          firstNameAr: provider?.firstNameAr ?? null,
          lastNameAr: provider?.lastNameAr ?? null,
          appointments: Number(row.count),
          encounters: encounterMap.get(row.providerId) ?? 0,
        };
      }),
      businessHealth: {
        utilizationPercent,
        collectionPercent,
        noShowPercent,
      },
      notifications: userNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        priority: n.priority,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      tasks: activeWorkflows.map((w) => ({
        id: w.id,
        nameEn: w.nameEn,
        nameAr: w.nameAr,
        status: w.status,
        currentStepIndex: w.currentStepIndex,
        stepsTotal: w.steps.length,
        updatedAt: w.updatedAt.toISOString(),
      })),
      subscription,
    };
  }

  private fillAppointmentTrend(
    rows: Array<{ day: Date; count: bigint }>,
    trendStart: Date,
    days: number,
  ): Array<{ date: string; count: number }> {
    const byDate = new Map(
      rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
    );
    return buildUtcDateSeries(trendStart, days).map((date) => ({
      date,
      count: byDate.get(date) ?? 0,
    }));
  }

  private fillRevenueTrend(
    rows: Array<{ day: Date; amount: Prisma.Decimal }>,
    trendStart: Date,
    days: number,
  ): Array<{ date: string; amount: number }> {
    const byDate = new Map(
      rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.amount)]),
    );
    return buildUtcDateSeries(trendStart, days).map((date) => ({
      date,
      amount: byDate.get(date) ?? 0,
    }));
  }
}