import { describe, expect, it } from '@jest/globals';

import type { DashboardOverviewDto } from '../../../dashboard/application/dashboard-overview.service';

import { buildAnalyticsReportCsv, countAnalyticsReportRows } from './analytics-report-csv';



function sampleOverview(): DashboardOverviewDto {

  return {

    generatedAt: '2026-06-15T12:00:00.000Z',

    live: {

      date: '2026-06-15',

      appointmentsToday: 12,

      newPatientsToday: 3,

      queueDepth: 2,

      activeUsers: 5,

    },

    kpis: {

      totalPatients: 120,

      appointmentsToday: 12,

      appointmentsPending: 4,

      encountersOpen: 2,

      revenueToday: 1500,

      revenueMonth: 42000,

      outstandingAmount: 800,

      queueWaiting: 2,

      lowStockCount: 1,

    },

    businessHealth: {

      utilizationPercent: 72,

      collectionPercent: 88,

      noShowPercent: 6,

    },

    revenueTrend: [

      { date: '2026-06-13', amount: 900 },

      { date: '2026-06-14', amount: 1100 },

    ],

    appointmentTrend: [],

    todayAppointments: [],

    queue: [],

    lowStockItems: [],

    recentActivities: [],

    patientGrowthTrend: [],

    branchPerformance: [],

    doctorPerformance: [],

    notifications: [],

    tasks: [],

    subscription: null,

  } as DashboardOverviewDto;

}



describe('analytics-report-csv', () => {

  it('builds localized CSV with BOM and KPI sections', () => {

    const csv = buildAnalyticsReportCsv(sampleOverview(), 'Monthly revenue', 'en-US');

    expect(csv.startsWith('\uFEFF')).toBe(true);

    expect(csv).toContain('Key performance indicators');

    expect(csv).toContain('Total patients');

    expect(csv).toContain('Revenue trend');

  });



  it('builds Arabic CSV labels', () => {

    const csv = buildAnalyticsReportCsv(sampleOverview(), 'ملخص الإيراد', 'ar-SY');

    expect(csv).toContain('مؤشرات الأداء الرئيسية');

  });



  it('counts data rows including revenue trend', () => {

    expect(countAnalyticsReportRows(sampleOverview())).toBe(11);

  });

});

