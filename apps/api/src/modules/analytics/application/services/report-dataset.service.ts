import type { DashboardOverviewDto } from '../../../dashboard/application/dashboard-overview.service';

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Apply builder/advanced filters and slice overview by report type / dataset. */
export function buildReportDataset(
  overview: DashboardOverviewDto,
  reportType: string,
  parameters: Record<string, unknown> = {},
): DashboardOverviewDto {
  const dataset = str(parameters.dataset) || reportType;
  const doctorId = str(parameters.doctorId);
  const status = str(parameters.status);

  const filtered: DashboardOverviewDto = {
    ...overview,
    todayAppointments: [...overview.todayAppointments],
    queue: [...overview.queue],
    lowStockItems: [...overview.lowStockItems],
    recentActivities: [...overview.recentActivities],
    revenueTrend: [...overview.revenueTrend],
    appointmentTrend: [...overview.appointmentTrend],
    patientGrowthTrend: [...overview.patientGrowthTrend],
    branchPerformance: [...overview.branchPerformance],
    doctorPerformance: [...overview.doctorPerformance],
    kpis: { ...overview.kpis },
    businessHealth: { ...overview.businessHealth },
    live: { ...overview.live },
  };

  if (doctorId) {
    filtered.todayAppointments = filtered.todayAppointments.filter((a) => a.providerId === doctorId);
    filtered.doctorPerformance = filtered.doctorPerformance.filter((d) => d.providerId === doctorId);
  }
  if (status) {
    filtered.todayAppointments = filtered.todayAppointments.filter((a) => a.status === status);
    filtered.queue = filtered.queue.filter((q) => q.status === status);
  }

  switch (dataset) {
    case 'revenue':
    case 'financial':
      filtered.lowStockItems = [];
      filtered.queue = [];
      filtered.patientGrowthTrend = [];
      filtered.appointmentTrend = [];
      filtered.doctorPerformance = [];
      break;
    case 'appointments':
    case 'operational':
      filtered.lowStockItems = [];
      filtered.revenueTrend = [];
      filtered.patientGrowthTrend = [];
      break;
    case 'patients':
    case 'clinical':
      filtered.lowStockItems = [];
      filtered.revenueTrend = [];
      filtered.appointmentTrend = [];
      filtered.branchPerformance = [];
      break;
    case 'inventory':
      filtered.todayAppointments = [];
      filtered.queue = [];
      filtered.revenueTrend = [];
      filtered.appointmentTrend = [];
      filtered.patientGrowthTrend = [];
      filtered.doctorPerformance = [];
      filtered.branchPerformance = [];
      break;
    case 'executive':
    case 'custom':
    case 'overview':
    default:
      break;
  }

  return filtered;
}

export function resolveDatasetBranchId(
  reportBranchId: string | null | undefined,
  parameters: Record<string, unknown>,
): string | null {
  const fromParams = str(parameters.branchId);
  if (fromParams) return fromParams;
  return reportBranchId ?? null;
}
