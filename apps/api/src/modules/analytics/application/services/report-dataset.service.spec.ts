import { buildReportDataset } from './report-dataset.service';

describe('report-dataset.service', () => {
  const baseOverview = {
    generatedAt: new Date().toISOString(),
    live: { date: '2026-01-01', appointmentsToday: 1, newPatientsToday: 1, queueDepth: 1, activeUsers: 1 },
    kpis: {
      totalPatients: 10,
      appointmentsToday: 2,
      appointmentsPending: 1,
      encountersOpen: 1,
      revenueToday: 100,
      revenueMonth: 500,
      outstandingAmount: 50,
      queueWaiting: 3,
      lowStockCount: 1,
    },
    revenueTrend: [{ date: '2026-01-01', amount: 10 }],
    appointmentTrend: [{ date: '2026-01-01', count: 2 }],
    todayAppointments: [
      { id: 'a1', patientId: 'p1', providerId: 'd1', scheduledStart: '', scheduledEnd: '', status: 'completed' },
      { id: 'a2', patientId: 'p2', providerId: 'd2', scheduledStart: '', scheduledEnd: '', status: 'queued' },
    ],
    queue: [],
    lowStockItems: [{ id: 'i1', sku: 's', nameEn: 'Item', nameAr: null, quantityOnHand: 1, reorderThreshold: 5 }],
    recentActivities: [],
    patientGrowthTrend: [],
    branchPerformance: [],
    doctorPerformance: [],
    businessHealth: { completionRate: 0.9, noShowRate: 0.1, collectionRate: 0.8 },
  } as const;

  it('filters by doctor and status', () => {
    const result = buildReportDataset(baseOverview as never, 'operational', {
      doctorId: 'd1',
      status: 'completed',
    });
    expect(result.todayAppointments).toHaveLength(1);
    expect(result.todayAppointments[0]?.providerId).toBe('d1');
  });

  it('slices inventory dataset', () => {
    const result = buildReportDataset(baseOverview as never, 'inventory', { dataset: 'inventory' });
    expect(result.lowStockItems.length).toBeGreaterThan(0);
    expect(result.revenueTrend).toHaveLength(0);
  });
});
