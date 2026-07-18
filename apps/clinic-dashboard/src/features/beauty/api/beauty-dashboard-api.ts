import { apiRequest } from '@/lib/api-client';

export interface BeautyDashboardResponse {
  todayAppointments: {
    id: string;
    patientId: string;
    patientName: string;
    scheduledStart: string;
    status: string;
    serviceType: string | null;
  }[];
  activeTreatmentPlans: {
    id: string;
    patientId: string;
    patientName: string;
    title: string;
    status: string;
    estimatedCost: number;
  }[];
  upcomingSessions: {
    id: string;
    patientId: string;
    patientName: string;
    type: string;
    scheduledAt: string;
  }[];
  revenueSummary: {
    revenueThisWeek: number;
    collectedThisWeek: number;
    outstandingThisWeek: number;
    currency: string;
  };
  followUpPatients: number;
  beforeAfterActivity: {
    id: string;
    patientId: string | null;
    filename: string;
    role: string | null;
    createdAt: string;
  }[];
  clinicalAlerts: {
    id: string;
    patientId: string;
    patientName: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    href: string;
  }[];
}

export async function fetchBeautyDashboard(token: string, tenantId: string): Promise<BeautyDashboardResponse> {
  return apiRequest('/beauty/dashboard', { token, tenantId });
}
