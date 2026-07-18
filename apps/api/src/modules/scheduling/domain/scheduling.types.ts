import { AppointmentStatus } from './appointment-status.enum';

export interface AppointmentListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  patientName: string;
  providerId: string;
  start: string;
  end: string;
  status: AppointmentStatus | 'no_show';
  notes: string | null;
  serviceType: string | null;
  isEmergency: boolean;
  recurrenceSeriesId: string | null;
  resourceId: string | null;
  resourceName?: string | null;
  createdAt: Date;
}

export interface AppointmentDetail extends AppointmentListItem {
  updatedAt: string;
  cancellationReason?: string | null;
}

export interface AppointmentListFilter {
  tenantId: string;
  branchId?: string | null;
  providerId?: string;
  patientId?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  limit: number;
  offset: number;
}
