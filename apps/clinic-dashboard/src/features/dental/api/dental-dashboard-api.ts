import { apiRequest } from '@/lib/api-client';

export interface DentalDashboardResponse {
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
    totalEstimatedCost: number | null;
  }[];
  revenueSummary: {
    revenueThisWeek: number;
    collectedThisWeek: number;
    outstandingThisWeek: number;
    currency: string;
  };
  pendingProcedures: number;
  pendingApprovalPlans: number;
  followUpPatients: number;
  clinicalAlerts: {
    id: string;
    patientId: string;
    patientName: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    href: string;
  }[];
}

export async function fetchDentalDashboard(
  token: string,
  tenantId: string,
): Promise<DentalDashboardResponse> {
  return apiRequest('/dental/dashboard', { token, tenantId });
}
