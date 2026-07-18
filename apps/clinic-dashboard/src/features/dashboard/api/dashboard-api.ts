import { apiRequest } from '@/lib/api-client';

export type DashboardRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DashboardCustomRange {
  from: string;
  to: string;
}

export interface DashboardBranch {
  id: string;
  name: string;
  nameAr: string | null;
}

const TREND_DAYS: Record<Exclude<DashboardRange, 'custom'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface DashboardOverview {  generatedAt: string;
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

export async function fetchDashboardBranches(
  token: string,
  tenantId?: string | null,
): Promise<DashboardBranch[]> {
  const body = await apiRequest<{ branches: DashboardBranch[] }>('/dashboard/branches', {
    token,
    tenantId,
  });
  return body.branches;
}

export async function fetchDashboardOverview(
  token: string,
  branchId: string | null | undefined,
  tenantId?: string | null,
  range: DashboardRange = '7d',
  customRange?: DashboardCustomRange,
): Promise<DashboardOverview> {
  const params = new URLSearchParams({ range });
  if (range === 'custom' && customRange) {
    params.set('from', customRange.from);
    params.set('to', customRange.to);
  }
  if (branchId === null) {
    params.set('branchId', 'all');
  } else if (branchId) {
    params.set('branchId', branchId);
  }
  return apiRequest<DashboardOverview>(`/dashboard/overview?${params}`, { token, tenantId });
}

/** Demo snapshot when API is unavailable (offline / dev without backend) */
export function createDemoOverview(
  range: DashboardRange = '7d',
  customRange?: DashboardCustomRange,
): DashboardOverview {
  const today = new Date().toISOString().slice(0, 10);
  let days = TREND_DAYS['7d'];
  if (range === 'custom' && customRange) {
    const start = new Date(`${customRange.from}T00:00:00.000Z`);
    const end = new Date(`${customRange.to}T00:00:00.000Z`);
    days = Math.min(Math.max(Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1, 1), 366);
  } else if (range !== 'custom') {
    days = TREND_DAYS[range];
  }
  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  return {
    generatedAt: new Date().toISOString(),
    live: {
      date: today,
      appointmentsToday: 24,
      newPatientsToday: 6,
      queueDepth: 5,
      activeUsers: 12,
    },
    kpis: {
      totalPatients: 1842,
      appointmentsToday: 24,
      appointmentsPending: 8,
      encountersOpen: 4,
      revenueToday: 485000,
      revenueMonth: 12450000,
      outstandingAmount: 890000,
      queueWaiting: 5,
      lowStockCount: 3,
    },
    revenueTrend: trend.map((date, i) => ({ date, amount: 320000 + i * 45000 })),
    appointmentTrend: trend.map((date, i) => ({ date, count: 18 + i * 2 })),
    todayAppointments: [
      {
        id: '1',
        patientId: 'p1',
        providerId: 'd1',
        scheduledStart: `${today}T09:00:00.000Z`,
        scheduledEnd: `${today}T09:30:00.000Z`,
        status: 'CONFIRMED',
      },
      {
        id: '2',
        patientId: 'p2',
        providerId: 'd1',
        scheduledStart: `${today}T09:30:00.000Z`,
        scheduledEnd: `${today}T10:00:00.000Z`,
        status: 'PENDING',
      },
    ],
    queue: [
      {
        id: 'q1',
        patientId: 'p3',
        status: 'WAITING',
        waitTimeSeconds: 420,
        checkedInAt: new Date(Date.now() - 420_000).toISOString(),
        scheduledStart: `${today}T10:00:00.000Z`,
      },
    ],
    lowStockItems: [
      {
        id: 'i1',
        sku: 'GLV-M',
        nameEn: 'Exam Gloves (M)',
        nameAr: 'قفازات فحص (وسط)',
        quantityOnHand: 12,
        reorderThreshold: 50,
      },
    ],
    recentActivities: [
      {
        id: 'a1',
        action: 'invoice.paid',
        descriptionEn: 'Invoice #1042 paid',
        descriptionAr: 'تم دفع الفاتورة #1042',
        createdAt: new Date().toISOString(),
      },
    ],
    patientGrowthTrend: trend.map((date, i) => ({ date, count: 3 + i })),
    branchPerformance: [
      {
        branchId: 'b1',
        name: 'Main Branch',
        nameAr: 'الفرع الرئيسي',
        appointments: 142,
        revenue: 3200000,
      },
      {
        branchId: 'b2',
        name: 'North Branch',
        nameAr: 'الفرع الشمالي',
        appointments: 98,
        revenue: 2100000,
      },
    ],
    doctorPerformance: [
      {
        providerId: 'd1',
        firstName: 'Sara',
        lastName: 'Haddad',
        firstNameAr: 'سارة',
        lastNameAr: 'حداد',
        appointments: 56,
        encounters: 48,
      },
      {
        providerId: 'd2',
        firstName: 'Omar',
        lastName: 'Nasser',
        firstNameAr: 'عمر',
        lastNameAr: 'ناصر',
        appointments: 44,
        encounters: 39,
      },
    ],
    businessHealth: {
      utilizationPercent: 87,
      collectionPercent: 92,
      noShowPercent: 4,
    },
    notifications: [],
    tasks: [],
    subscription: {
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      endDate: null,
      pricePerMonth: 299,
      currency: 'USD',
    },
  };
}
