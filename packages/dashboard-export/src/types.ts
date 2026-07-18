export interface DashboardOverviewForExport {
  generatedAt: string;
  kpis: {
    totalPatients: number;
    appointmentsToday: number;
    queueWaiting: number;
    revenueToday: number;
    revenueMonth: number;
    outstandingAmount: number;
    lowStockCount: number;
  };
  businessHealth: {
    utilizationPercent: number;
    collectionPercent: number;
    noShowPercent: number;
  };
  revenueTrend: Array<{ date: string; amount: number }>;
  appointmentTrend: Array<{ date: string; count: number }>;
  patientGrowthTrend: Array<{ date: string; count: number }>;
  branchPerformance: Array<{
    name: string;
    nameAr: string | null;
    appointments: number;
    revenue: number;
  }>;
  doctorPerformance: Array<{
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    appointments: number;
    encounters: number;
  }>;
}

export interface DashboardExportLabels {
  title: string;
  generatedAt: string;
  kpisSection: string;
  healthSection: string;
  revenueTrendSection: string;
  appointmentTrendSection: string;
  patientGrowthSection: string;
  branchSection: string;
  doctorSection: string;
  metric: string;
  value: string;
  date: string;
  amount: string;
  count: string;
  appointments: string;
  revenue: string;
  encounters: string;
  provider: string;
  branch: string;
  totalPatients: string;
  appointmentsToday: string;
  queueWaiting: string;
  revenueToday: string;
  revenueMonth: string;
  outstandingAmount: string;
  lowStockCount: string;
  utilization: string;
  collection: string;
  noShow: string;
}
