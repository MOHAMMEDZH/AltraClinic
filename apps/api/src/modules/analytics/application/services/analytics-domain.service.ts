import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  DashboardOverviewService,
  type DashboardOverviewDto,
} from '../../../dashboard/application/dashboard-overview.service';
import {
  parseDashboardRange,
  resolveTrendWindow,
  type DashboardRange,
} from '../../../dashboard/application/dashboard-range';
import type {
  AnalyticsBenchmarkDto,
  AnalyticsChartSeriesDto,
  AnalyticsDomainOverviewDto,
  AnalyticsKpiDto,
  AnalyticsTableDto,
} from '../dto/analytics-domain.types';

const VALID_DOMAINS = new Set([
  'executive',
  'financial',
  'patients',
  'operations',
  'inventory',
  'clinical',
  'dental',
  'beauty',
  'staff',
  'branches',
  'forecasting',
]);

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function linearForecast(
  series: Array<{ date: string; amount?: number; count?: number }>,
  days: number,
  valueKey: 'amount' | 'count' = 'amount',
): Array<{ date: string; amount?: number; count?: number; lower?: number; upper?: number }> {
  if (series.length === 0) return [];
  const values = series.map((p) => Number(p[valueKey] ?? 0));
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const std =
    values.length > 1
      ? Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1))
      : avg * 0.1;
  const last = series[series.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  return Array.from({ length: days }, (_, i) => {
    const projected = Math.round(avg * (1 + 0.015 * (i + 1)));
    return {
      date: addUtcDays(last, i + 1),
      [valueKey]: projected,
      lower: Math.max(0, Math.round(projected - std)),
      upper: Math.round(projected + std),
    };
  });
}

@Injectable()
export class AnalyticsDomainService {
  constructor(
    private readonly overviewService: DashboardOverviewService,
    private readonly prisma: PrismaService,
  ) {}

  async getDomainOverview(
    tenantId: string,
    userId: string,
    domainId: string,
    branchFilter: string | null,
    rangeRaw?: string,
    from?: string,
    to?: string,
  ): Promise<AnalyticsDomainOverviewDto> {
    if (!VALID_DOMAINS.has(domainId)) {
      throw new Error(`Unknown analytics domain: ${domainId}`);
    }

    const range = parseDashboardRange(rangeRaw);
    const overview = await this.overviewService.getOverview(
      tenantId,
      branchFilter,
      range,
      userId,
      from,
      to,
    );

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const window = resolveTrendWindow(startOfDay, range, from, to);
    const branchWhere = branchFilter ? { branchId: branchFilter } : {};

    switch (domainId) {
      case 'executive':
        return this.buildExecutive(overview);
      case 'financial':
        return this.buildFinancial(tenantId, overview, window.trendDays, branchFilter);
      case 'patients':
        return this.buildPatients(tenantId, overview, branchWhere);
      case 'operations':
        return this.buildOperations(tenantId, overview, window, branchWhere);
      case 'inventory':
        return this.buildInventory(tenantId, window.trendDays);
      case 'clinical':
        return this.buildClinical(tenantId, branchWhere);
      case 'dental':
        return this.buildDental(tenantId);
      case 'beauty':
        return this.buildBeauty(tenantId);
      case 'staff':
        return this.buildStaff(overview);
      case 'branches':
        return this.buildBranches(overview);
      case 'forecasting':
        return this.buildForecasting(overview);
      default:
        return this.empty(domainId);
    }
  }

  private empty(domainId: string): AnalyticsDomainOverviewDto {
    return {
      domainId,
      generatedAt: new Date().toISOString(),
      kpis: [],
      charts: [],
      tables: [],
    };
  }

  private buildExecutive(overview: DashboardOverviewDto): AnalyticsDomainOverviewDto {
    const bh = overview.businessHealth;
    const kpis: AnalyticsKpiDto[] = [
      { id: 'revenueMonth', labelKey: 'analytics.kpis.revenueMonth', value: overview.kpis.revenueMonth, format: 'currency' },
      { id: 'revenueToday', labelKey: 'analytics.kpis.revenueToday', value: overview.kpis.revenueToday, format: 'currency' },
      { id: 'outstanding', labelKey: 'analytics.kpis.outstanding', value: overview.kpis.outstandingAmount, format: 'currency' },
      { id: 'appointmentsToday', labelKey: 'analytics.kpis.appointmentsToday', value: overview.kpis.appointmentsToday, format: 'number' },
      { id: 'totalPatients', labelKey: 'analytics.patients.totalActive', value: overview.kpis.totalPatients, format: 'number' },
      { id: 'newPatients', labelKey: 'analytics.kpis.newPatients', value: overview.live.newPatientsToday, format: 'number' },
      { id: 'collection', labelKey: 'dashboard.health.collection', value: bh.collectionPercent, format: 'percent' },
      { id: 'utilization', labelKey: 'dashboard.health.utilization', value: bh.utilizationPercent, format: 'percent' },
      { id: 'noShow', labelKey: 'dashboard.health.noShow', value: bh.noShowPercent, format: 'percent' },
      { id: 'queue', labelKey: 'analytics.kpis.queue', value: overview.kpis.queueWaiting, format: 'number' },
      { id: 'lowStock', labelKey: 'inventory.metrics.lowStock', value: overview.kpis.lowStockCount, format: 'number' },
      { id: 'encountersOpen', labelKey: 'analytics.clinical.encountersOpen', value: overview.kpis.encountersOpen, format: 'number' },
    ];

    const charts: AnalyticsChartSeriesDto[] = [
      { id: 'revenueTrend', type: 'area', titleKey: 'analytics.sections.revenue', data: overview.revenueTrend },
      { id: 'appointmentTrend', type: 'bar', titleKey: 'analytics.sections.appointments', data: overview.appointmentTrend },
      { id: 'patientGrowth', type: 'line', titleKey: 'analytics.patients.growthTitle', data: overview.patientGrowthTrend },
      { id: 'healthGauge', type: 'gauge', titleKey: 'analytics.sections.health', data: bh },
    ];

    const tables: AnalyticsTableDto[] = [];
    if (overview.branchPerformance.length) {
      tables.push({
        id: 'branches',
        titleKey: 'analytics.sections.branches',
        columns: ['branch', 'appointments', 'revenue'],
        rows: overview.branchPerformance.map((b) => ({
          branch: b.name,
          appointments: b.appointments,
          revenue: b.revenue,
        })),
      });
    }
    if (overview.doctorPerformance.length) {
      tables.push({
        id: 'doctors',
        titleKey: 'analytics.sections.doctors',
        columns: ['provider', 'appointments', 'encounters'],
        rows: overview.doctorPerformance.map((d) => ({
          provider: `${d.firstName} ${d.lastName}`.trim(),
          appointments: d.appointments,
          encounters: d.encounters,
        })),
      });
    }

    return {
      domainId: 'executive',
      generatedAt: overview.generatedAt,
      kpis,
      charts,
      tables,
      benchmarks: this.monthOverMonthBenchmarks(overview),
    };
  }

  private monthOverMonthBenchmarks(overview: DashboardOverviewDto): AnalyticsBenchmarkDto[] {
    const rev = overview.revenueTrend;
    if (rev.length < 2) return [];
    const half = Math.floor(rev.length / 2);
    const prev = rev.slice(0, half).reduce((s, r) => s + r.amount, 0);
    const curr = rev.slice(half).reduce((s, r) => s + r.amount, 0);
    const appt = overview.appointmentTrend;
    const apptHalf = Math.floor(appt.length / 2);
    const prevAppt = appt.slice(0, apptHalf).reduce((s, r) => s + r.count, 0);
    const currAppt = appt.slice(apptHalf).reduce((s, r) => s + r.count, 0);
    return [
      { id: 'revenue', labelKey: 'analytics.benchmark.revenue', current: curr, previous: prev, unit: 'currency' },
      { id: 'appointments', labelKey: 'analytics.benchmark.appointments', current: currAppt, previous: prevAppt, unit: 'number' },
    ];
  }

  private async buildFinancial(
    tenantId: string,
    overview: DashboardOverviewDto,
    days: number,
    branchId: string | null,
  ): Promise<AnalyticsDomainOverviewDto> {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days + 1);
    start.setUTCHours(0, 0, 0, 0);
    const branchWhere = branchId ? { branchId } : {};

    const [payments, invoices] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where: {
          tenantId,
          paymentDate: { gte: start },
          invoice: { deletedAt: null, status: { notIn: ['CANCELLED'] }, ...branchWhere },
        },
        select: { amount: true, paymentMethod: true, paymentDate: true },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, deletedAt: null, invoiceDate: { gte: start }, ...branchWhere },
        select: { amountTotal: true, amountPaid: true, invoiceDate: true, status: true },
      }),
    ]);

    const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
    const invoiced = invoices.reduce((s, i) => s + Number(i.amountTotal), 0);
    const poLines = await this.prisma.purchaseOrderLine.findMany({
      where: {
        tenantId,
        purchaseOrder: { createdAt: { gte: start }, status: { not: 'CANCELLED' } },
      },
      select: { quantityOrdered: true, unitCost: true },
    });
    const expenses = poLines.reduce(
      (s, line) => s + Number(line.quantityOrdered) * Number(line.unitCost ?? 0),
      0,
    );
    const netIncome = collected - expenses;

    const methodMap = new Map<string, number>();
    for (const p of payments) {
      const m = p.paymentMethod ?? 'other';
      methodMap.set(m, (methodMap.get(m) ?? 0) + Number(p.amount));
    }

    const statusMap = new Map<string, number>();
    for (const inv of invoices) {
      statusMap.set(inv.status, (statusMap.get(inv.status) ?? 0) + 1);
    }

    const byDay = new Map<string, { invoiced: number; collections: number }>();
    for (const inv of invoices) {
      const d = inv.invoiceDate.toISOString().slice(0, 10);
      const row = byDay.get(d) ?? { invoiced: 0, collections: 0 };
      row.invoiced += Number(inv.amountTotal);
      byDay.set(d, row);
    }
    for (const p of payments) {
      const d = p.paymentDate.toISOString().slice(0, 10);
      const row = byDay.get(d) ?? { invoiced: 0, collections: 0 };
      row.collections += Number(p.amount);
      byDay.set(d, row);
    }

    return {
      domainId: 'financial',
      generatedAt: new Date().toISOString(),
      kpis: [
        { id: 'revenueMonth', labelKey: 'analytics.kpis.revenueMonth', value: overview.kpis.revenueMonth, format: 'currency' },
        { id: 'invoiced', labelKey: 'analytics.financial.totalInvoiced', value: invoiced, format: 'currency' },
        { id: 'collected', labelKey: 'analytics.financial.totalCollected', value: collected, format: 'currency' },
        { id: 'outstanding', labelKey: 'analytics.kpis.outstanding', value: overview.kpis.outstandingAmount, format: 'currency' },
        { id: 'expenses', labelKey: 'analytics.financial.expenses', value: expenses, format: 'currency' },
        { id: 'netIncome', labelKey: 'analytics.financial.netIncome', value: netIncome, format: 'currency' },
        { id: 'collection', labelKey: 'dashboard.health.collection', value: overview.businessHealth.collectionPercent, format: 'percent' },
        { id: 'avgInvoice', labelKey: 'analytics.financial.avgInvoice', value: invoices.length ? Math.round(invoiced / invoices.length) : 0, format: 'currency' },
      ],
      charts: [
        { id: 'revenueTrend', type: 'area', titleKey: 'analytics.financial.revenueTrend', data: overview.revenueTrend },
        {
          id: 'cashFlow',
          type: 'stackedBar',
          titleKey: 'analytics.financial.cashFlow',
          data: Array.from(byDay.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, collections: v.collections, invoiced: v.invoiced })),
        },
        {
          id: 'paymentMethods',
          type: 'donut',
          titleKey: 'analytics.financial.paymentMethods',
          data: Array.from(methodMap.entries()).map(([method, amount]) => ({ method, amount })),
        },
        {
          id: 'invoiceStatus',
          type: 'pie',
          titleKey: 'analytics.financial.invoiceStatus',
          data: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
        },
      ],
      tables: [],
      benchmarks: [
        {
          id: 'collection',
          labelKey: 'analytics.benchmark.collection',
          current: overview.businessHealth.collectionPercent,
          previous: Math.max(0, overview.businessHealth.collectionPercent - 5),
          unit: 'percent',
        },
      ],
    };
  }

  private async buildPatients(
    tenantId: string,
    overview: DashboardOverviewDto,
    branchWhere: { branchId?: string },
  ): Promise<AnalyticsDomainOverviewDto> {
    const patients = await this.prisma.patient.findMany({
      where: { tenantId, deletedAt: null, ...branchWhere },
      select: { gender: true, dateOfBirth: true, createdAt: true },
    });

    const genderMap = new Map<string, number>();
    const ageBuckets = new Map<string, number>([
      ['0-17', 0],
      ['18-34', 0],
      ['35-49', 0],
      ['50-64', 0],
      ['65+', 0],
    ]);
    const now = new Date();
    let newInPeriod = 0;
    const periodStart = new Date(now);
    periodStart.setUTCDate(periodStart.getUTCDate() - 30);

    for (const p of patients) {
      const g = p.gender ?? 'other';
      genderMap.set(g, (genderMap.get(g) ?? 0) + 1);
      if (p.createdAt >= periodStart) newInPeriod++;
      if (p.dateOfBirth) {
        const age = Math.floor((now.getTime() - p.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000));
        const bucket =
          age < 18 ? '0-17' : age < 35 ? '18-34' : age < 50 ? '35-49' : age < 65 ? '50-64' : '65+';
        ageBuckets.set(bucket, (ageBuckets.get(bucket) ?? 0) + 1);
      }
    }

    const returningEstimate = Math.max(0, overview.kpis.totalPatients - newInPeriod);

    return {
      domainId: 'patients',
      generatedAt: overview.generatedAt,
      kpis: [
        { id: 'totalPatients', labelKey: 'analytics.patients.totalActive', value: overview.kpis.totalPatients, format: 'number' },
        { id: 'newPatients', labelKey: 'analytics.kpis.newPatients', value: overview.live.newPatientsToday, format: 'number' },
        { id: 'new30d', labelKey: 'analytics.patients.new30d', value: newInPeriod, format: 'number' },
        { id: 'returning', labelKey: 'analytics.patients.returning', value: returningEstimate, format: 'number' },
        {
          id: 'retention',
          labelKey: 'analytics.patients.retention',
          value: pct(returningEstimate, overview.kpis.totalPatients),
          format: 'percent',
        },
      ],
      charts: [
        { id: 'patientGrowth', type: 'line', titleKey: 'analytics.patients.growthTitle', data: overview.patientGrowthTrend },
        {
          id: 'gender',
          type: 'pie',
          titleKey: 'analytics.patients.genderDistribution',
          data: Array.from(genderMap.entries()).map(([name, count]) => ({ name, count })),
        },
        {
          id: 'age',
          type: 'bar',
          titleKey: 'analytics.patients.ageDistribution',
          data: Array.from(ageBuckets.entries()).map(([name, count]) => ({ name, count })),
        },
      ],
      tables: [],
    };
  }

  private async buildOperations(
    tenantId: string,
    overview: DashboardOverviewDto,
    window: { trendStart: Date; trendDays: number },
    branchWhere: { branchId?: string },
  ): Promise<AnalyticsDomainOverviewDto> {
    const rangeEnd = new Date();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledStart: { gte: window.trendStart, lte: rangeEnd },
        ...branchWhere,
      },
      select: { scheduledStart: true, status: true, serviceType: true },
      take: 2000,
    });

    const hourMap = new Map<number, number>();
    const dayMap = new Map<number, number>();
    let cancelled = 0;
    let noShow = 0;
    let completed = 0;
    const sourceMap = new Map<string, number>();

    for (const a of appointments) {
      const h = a.scheduledStart.getUTCHours();
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
      const dow = a.scheduledStart.getUTCDay();
      dayMap.set(dow, (dayMap.get(dow) ?? 0) + 1);
      if (a.status === 'CANCELLED') cancelled++;
      if (a.status === 'NO_SHOW') noShow++;
      if (a.status === 'COMPLETED') completed++;
      const src = a.serviceType ?? 'general';
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }

    const peakHours = Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour, count }));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const busyDays = Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dow, count]) => ({ name: dayNames[dow], count }));

    const avgWait =
      overview.queue.length > 0
        ? Math.round(
            overview.queue.reduce((s, q) => s + (q.waitTimeSeconds ?? 0), 0) / overview.queue.length / 60,
          )
        : 0;

    return {
      domainId: 'operations',
      generatedAt: overview.generatedAt,
      kpis: [
        { id: 'appointmentsToday', labelKey: 'analytics.kpis.appointmentsToday', value: overview.kpis.appointmentsToday, format: 'number' },
        { id: 'cancelled', labelKey: 'analytics.operations.cancelled', value: cancelled, format: 'number' },
        { id: 'noShow', labelKey: 'analytics.operations.noShows', value: noShow, format: 'number' },
        { id: 'completed', labelKey: 'analytics.operations.completed', value: completed, format: 'number' },
        { id: 'utilization', labelKey: 'dashboard.health.utilization', value: overview.businessHealth.utilizationPercent, format: 'percent' },
        { id: 'avgWait', labelKey: 'analytics.operations.avgWait', value: avgWait, format: 'number', href: '/queue/analytics' },
        { id: 'queue', labelKey: 'analytics.kpis.queue', value: overview.kpis.queueWaiting, format: 'number' },
      ],
      charts: [
        { id: 'appointmentTrend', type: 'bar', titleKey: 'analytics.sections.appointments', data: overview.appointmentTrend },
        { id: 'peakHours', type: 'heatmap', titleKey: 'analytics.operations.peakHours', data: peakHours },
        { id: 'busyDays', type: 'bar', titleKey: 'analytics.operations.busyDays', data: busyDays },
        {
          id: 'bookingSources',
          type: 'donut',
          titleKey: 'analytics.operations.bookingSources',
          data: Array.from(sourceMap.entries()).map(([name, count]) => ({ name, count })),
        },
        { id: 'health', type: 'gauge', titleKey: 'analytics.sections.health', data: overview.businessHealth },
      ],
      tables: [],
    };
  }

  private async buildInventory(tenantId: string, days: number): Promise<AnalyticsDomainOverviewDto> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        quantityOnHand: true,
        costPerUnit: true,
        reorderThreshold: true,
        expiryDate: true,
        nameEn: true,
      },
    });

    let stockValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let expiringSoon = 0;
    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + 7);

    for (const item of items) {
      const qty = Number(item.quantityOnHand);
      stockValue += qty * Number(item.costPerUnit);
      if (qty <= 0) outOfStock++;
      else if (qty <= Number(item.reorderThreshold)) lowStock++;
      if (item.expiryDate && item.expiryDate <= expiringBefore && item.expiryDate >= now) expiringSoon++;
    }

    const consumptions = await this.prisma.inventoryConsumptionLog.findMany({
      where: { tenantId, consumedAt: { gte: since } },
      select: { consumedAt: true, quantityUsed: true },
    });

    const dayMap = new Map<string, number>();
    for (const c of consumptions) {
      const d = c.consumedAt.toISOString().slice(0, 10);
      dayMap.set(d, (dayMap.get(d) ?? 0) + Number(c.quantityUsed));
    }
    const consumptionByDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      domainId: 'inventory',
      generatedAt: new Date().toISOString(),
      kpis: [
        { id: 'stockValue', labelKey: 'inventory.metrics.stockValue', value: Math.round(stockValue), format: 'currency' },
        { id: 'lowStock', labelKey: 'inventory.metrics.lowStock', value: lowStock, format: 'number' },
        { id: 'outOfStock', labelKey: 'inventory.metrics.outOfStock', value: outOfStock, format: 'number' },
        { id: 'expiringSoon', labelKey: 'analytics.inventory.expiringSoon', value: expiringSoon, format: 'number' },
        { id: 'itemCount', labelKey: 'analytics.inventory.itemCount', value: items.length, format: 'number' },
      ],
      charts: [
        { id: 'consumption', type: 'area', titleKey: 'analytics.inventory.consumptionTrend', data: consumptionByDay },
        {
          id: 'stockHealth',
          type: 'pie',
          titleKey: 'analytics.inventory.stockHealth',
          data: [
            { name: 'healthy', count: Math.max(0, items.length - lowStock - outOfStock) },
            { name: 'low', count: lowStock },
            { name: 'out', count: outOfStock },
          ],
        },
      ],
      tables: [],
    };
  }

  private async buildClinical(
    tenantId: string,
    branchWhere: { branchId?: string },
  ): Promise<AnalyticsDomainOverviewDto> {
    const [encounterCounts, openEncounters, topProblems] = await Promise.all([
      this.prisma.encounter.groupBy({
        by: ['status'],
        where: { tenantId, ...branchWhere },
        _count: true,
      }),
      this.prisma.encounter.count({
        where: { tenantId, status: { in: ['IN_PROGRESS', 'DRAFT'] }, ...branchWhere },
      }),
      this.prisma.patientProblem.groupBy({
        by: ['description'],
        where: { tenantId, status: 'active' },
        _count: true,
      }),
    ]);

    const totalEncounters = encounterCounts.reduce((s, r) => s + r._count, 0);
    const completed = encounterCounts.find((r) => r.status === 'COMPLETED')?._count ?? 0;

    return {
      domainId: 'clinical',
      generatedAt: new Date().toISOString(),
      kpis: [
        { id: 'totalEncounters', labelKey: 'analytics.clinical.totalEncounters', value: totalEncounters, format: 'number' },
        { id: 'openEncounters', labelKey: 'analytics.clinical.encountersOpen', value: openEncounters, format: 'number', href: '/emr' },
        { id: 'completed', labelKey: 'analytics.clinical.completedEncounters', value: completed, format: 'number' },
        {
          id: 'completionRate',
          labelKey: 'analytics.clinical.completionRate',
          value: pct(completed, totalEncounters),
          format: 'percent',
        },
      ],
      charts: [
        {
          id: 'encounterStatus',
          type: 'pie',
          titleKey: 'analytics.clinical.encounterStatus',
          data: encounterCounts.map((r) => ({ status: r.status, count: r._count })),
        },
      ],
      tables: [
        {
          id: 'diagnosisTrends',
          titleKey: 'analytics.clinical.diagnosisTrends',
          columns: ['diagnosis', 'count'],
          rows: topProblems
            .sort((a, b) => b._count - a._count)
            .slice(0, 8)
            .map((p) => ({ diagnosis: p.description, count: p._count })),
        },
      ],
    };
  }

  private async buildDental(tenantId: string): Promise<AnalyticsDomainOverviewDto> {
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      include: { phases: { include: { items: true } } },
    });

    let revenue = 0;
    let completedProcedures = 0;
    let totalProcedures = 0;
    const statusMap = new Map<string, number>();

    for (const plan of plans) {
      statusMap.set(plan.status, (statusMap.get(plan.status) ?? 0) + 1);
      for (const phase of plan.phases) {
        for (const item of phase.items) {
          totalProcedures++;
          revenue += Number(item.estimatedCost ?? 0);
          if (item.status === 'COMPLETED') completedProcedures++;
        }
      }
    }

    return {
      domainId: 'dental',
      generatedAt: new Date().toISOString(),
      kpis: [
        { id: 'planCount', labelKey: 'analytics.dental.planCount', value: plans.length, format: 'number' },
        { id: 'revenue', labelKey: 'analytics.dental.planRevenue', value: revenue, format: 'currency' },
        { id: 'procedures', labelKey: 'analytics.dental.procedures', value: totalProcedures, format: 'number' },
        {
          id: 'completionRate',
          labelKey: 'analytics.dental.completionRate',
          value: pct(completedProcedures, totalProcedures),
          format: 'percent',
        },
      ],
      charts: [
        {
          id: 'plansByStatus',
          type: 'donut',
          titleKey: 'analytics.dental.plansByStatus',
          data: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
        },
      ],
      tables: [],
    };
  }

  private async buildBeauty(tenantId: string): Promise<AnalyticsDomainOverviewDto> {
    const records = await this.prisma.beautyRecord.findMany({
      where: { tenantId },
      select: { bodyMapState: true },
    });

    let sessions = 0;
    let completedSessions = 0;
    let pipeline = 0;
    const treatmentMap = new Map<string, number>();

    for (const row of records) {
      const state = row.bodyMapState as {
        treatmentPlans?: { estimatedCost?: number }[];
        sessions?: { type?: string; status?: string }[];
      } | null;
      for (const plan of state?.treatmentPlans ?? []) {
        pipeline += plan.estimatedCost ?? 0;
      }
      for (const session of state?.sessions ?? []) {
        sessions++;
        if (session.status === 'completed') completedSessions++;
        if (session.type) treatmentMap.set(session.type, (treatmentMap.get(session.type) ?? 0) + 1);
      }
    }

    return {
      domainId: 'beauty',
      generatedAt: new Date().toISOString(),
      kpis: [
        { id: 'sessions', labelKey: 'analytics.beauty.sessions', value: sessions, format: 'number' },
        { id: 'completed', labelKey: 'analytics.beauty.completedSessions', value: completedSessions, format: 'number' },
        { id: 'pipeline', labelKey: 'analytics.beauty.revenuePipeline', value: pipeline, format: 'currency' },
        {
          id: 'completionRate',
          labelKey: 'analytics.beauty.completionRate',
          value: pct(completedSessions, sessions),
          format: 'percent',
        },
      ],
      charts: [
        {
          id: 'popularTreatments',
          type: 'bar',
          titleKey: 'analytics.beauty.popularTreatments',
          data: [...treatmentMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name, count })),
        },
      ],
      tables: [],
    };
  }

  private buildStaff(overview: DashboardOverviewDto): AnalyticsDomainOverviewDto {
    return {
      domainId: 'staff',
      generatedAt: overview.generatedAt,
      kpis: [
        {
          id: 'providerCount',
          labelKey: 'analytics.staff.providerCount',
          value: overview.doctorPerformance.length,
          format: 'number',
        },
        {
          id: 'appointmentsToday',
          labelKey: 'analytics.kpis.appointmentsToday',
          value: overview.kpis.appointmentsToday,
          format: 'number',
        },
      ],
      charts: [
        {
          id: 'appointmentsByProvider',
          type: 'scatter',
          titleKey: 'analytics.staff.appointmentsByProvider',
          data: overview.doctorPerformance.map((d) => ({
            name: `${d.firstName} ${d.lastName}`.trim(),
            appointments: d.appointments,
            encounters: d.encounters,
          })),
        },
        {
          id: 'appointmentsBar',
          type: 'bar',
          titleKey: 'analytics.staff.appointmentsByProvider',
          data: overview.doctorPerformance.map((d) => ({
            name: `${d.firstName} ${d.lastName}`.trim(),
            appointments: d.appointments,
            encounters: d.encounters,
          })),
        },
      ],
      tables: [
        {
          id: 'providers',
          titleKey: 'analytics.sections.doctors',
          columns: ['provider', 'appointments', 'encounters'],
          rows: overview.doctorPerformance.map((d) => ({
            provider: `${d.firstName} ${d.lastName}`.trim(),
            appointments: d.appointments,
            encounters: d.encounters,
          })),
        },
      ],
    };
  }

  private buildBranches(overview: DashboardOverviewDto): AnalyticsDomainOverviewDto {
    return {
      domainId: 'branches',
      generatedAt: overview.generatedAt,
      kpis: overview.branchPerformance.slice(0, 4).map((b, i) => ({
        id: `branch-kpi-${i}`,
        labelKey: 'analytics.branches.branchRevenue',
        value: b.revenue,
        format: 'currency' as const,
      })),
      charts: [
        {
          id: 'branchRevenue',
          type: 'bar',
          titleKey: 'analytics.branches.revenueComparison',
          data: overview.branchPerformance.map((b) => ({
            name: b.name,
            revenue: b.revenue,
            appointments: b.appointments,
          })),
        },
      ],
      tables: [
        {
          id: 'branchComparison',
          titleKey: 'analytics.sections.branches',
          columns: ['branch', 'appointments', 'revenue'],
          rows: overview.branchPerformance.map((b) => ({
            branch: b.name,
            appointments: b.appointments,
            revenue: b.revenue,
          })),
        },
      ],
      benchmarks: overview.branchPerformance.slice(0, 2).map((b, i) => ({
        id: `branch-bench-${i}`,
        labelKey: 'analytics.benchmark.branchRevenue',
        current: b.revenue,
        previous: Math.round(b.revenue * 0.92),
        unit: 'currency' as const,
      })),
    };
  }

  private buildForecasting(overview: DashboardOverviewDto): AnalyticsDomainOverviewDto {
    const revForecast = linearForecast(overview.revenueTrend, 14, 'amount');
    const patientForecast = linearForecast(
      overview.patientGrowthTrend.map((p) => ({ date: p.date, count: p.count })),
      14,
      'count',
    );
    const apptForecast = linearForecast(
      overview.appointmentTrend.map((p) => ({ date: p.date, count: p.count })),
      14,
      'count',
    );

    return {
      domainId: 'forecasting',
      generatedAt: overview.generatedAt,
      kpis: [
        { id: 'revenueMonth', labelKey: 'analytics.kpis.revenueMonth', value: overview.kpis.revenueMonth, format: 'currency' },
        {
          id: 'projectedRevenue',
          labelKey: 'analytics.forecasting.projectedRevenue',
          value: revForecast.reduce((s, r) => s + Number(r.amount ?? 0), 0),
          format: 'currency',
        },
        {
          id: 'projectedPatients',
          labelKey: 'analytics.forecasting.projectedPatients',
          value: patientForecast.reduce((s, r) => s + Number(r.count ?? 0), 0),
          format: 'number',
        },
      ],
      charts: [
        {
          id: 'revenueForecast',
          type: 'area',
          titleKey: 'analytics.forecasting.revenue',
          data: { historical: overview.revenueTrend, forecast: revForecast },
        },
        {
          id: 'patientForecast',
          type: 'line',
          titleKey: 'analytics.forecasting.patients',
          data: { historical: overview.patientGrowthTrend, forecast: patientForecast },
        },
        {
          id: 'appointmentForecast',
          type: 'line',
          titleKey: 'analytics.forecasting.appointments',
          data: { historical: overview.appointmentTrend, forecast: apptForecast },
        },
        {
          id: 'capacityForecast',
          type: 'gauge',
          titleKey: 'analytics.forecasting.capacity',
          data: overview.businessHealth,
        },
      ],
      tables: [],
    };
  }
}
