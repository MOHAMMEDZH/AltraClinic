export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type AppointmentAction =
  | 'confirm'
  | 'cancel'
  | 'complete'
  | 'no_show'
  | 'check_in'
  | 'start_visit';

export interface AppointmentListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  patientName: string;
  providerId: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  notes: string | null;
  serviceType: string | null;
  isEmergency: boolean;
  recurrenceSeriesId: string | null;
  resourceId: string | null;
  resourceName?: string | null;
  createdAt: string;
}

export interface AppointmentDetail extends AppointmentListItem {
  updatedAt: string;
  cancellationReason?: string | null;
}

export interface AppointmentListResponse {
  items: AppointmentListItem[];
  total: number;
}

export interface SchedulingMetrics {
  total: number;
  pending: number;
  confirmed: number;
  checkedIn?: number;
  inProgress?: number;
  completed: number;
  cancelled: number;
  noShow: number;
  utilizationPercent?: number;
}

export interface SchedulingAnalytics {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  emergency: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  dailyBreakdown: Array<{
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>;
  byServiceType: Array<{ serviceType: string; count: number }>;
}

export interface SchedulingServiceType {
  id: string;
  defaultDurationMin: number;
}

export interface CreateAppointmentPayload {
  patientId: string;
  providerId: string;
  start: string;
  end: string;
  notes?: string;
  serviceType?: string;
  isEmergency?: boolean;
  recurrence?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    occurrences: number;
  };
  resourceId?: string;
}

export interface SchedulingResource {
  id: string;
  name: string;
  branchId: string | null;
  resourceType: 'room' | 'equipment';
}

export interface ResourceDayStatus {
  id: string;
  name: string;
  resourceType: string;
  bookingCount: number;
  available: boolean;
}

export interface AppointmentTemplate {
  id: string;
  name: string;
  serviceType: string | null;
  durationMin: number;
  providerId: string | null;
  notes: string | null;
  isEmergency: boolean;
}

export interface BulkRescheduleResult {
  updated: string[];
  failed: Array<{ id: string; reason: string }>;
  shiftDays: number;
}

export interface UpdateAppointmentPayload {
  action?: AppointmentAction;
  start?: string;
  end?: string;
  notes?: string | null;
  cancellationReason?: string | null;
  providerId?: string;
  serviceType?: string | null;
  isEmergency?: boolean;
  resourceId?: string | null;
  seriesScope?: 'future';
}

export interface SchedulingProvider {
  id: string;
  name: string;
  branchId: string | null;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  providerId: string | null;
  preferredDate: string | null;
  durationMin: number;
  notes: string | null;
  status: string;
  createdAt: string;
}

/** Wave G1 — AvailabilityException types. */
export type AvailabilityExceptionType =
  | 'PROVIDER_LEAVE'
  | 'BRANCH_HOLIDAY'
  | 'RESOURCE_MAINTENANCE'
  | 'EXTRA_AVAILABILITY';

export interface AvailabilityException {
  id: string;
  tenantId?: string;
  branchId: string | null;
  type: AvailabilityExceptionType;
  providerId: string | null;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Wave G2 — WaitlistOffer lifecycle. */
export type WaitlistOfferStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';

export interface WaitlistOffer {
  id: string;
  tenantId: string;
  branchId: string | null;
  waitlistEntryId: string;
  sourceAppointmentId: string | null;
  providerId: string;
  resourceId: string | null;
  offeredStartsAt: string;
  offeredEndsAt: string;
  expiresAt: string;
  status: WaitlistOfferStatus;
  appointmentId: string | null;
  acceptedAt: string | null;
  expiredAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Wave G3 — Recall SoR. */
export type PatientRecallStatus = 'DUE' | 'SNOOZED' | 'BOOKED' | 'COMPLETED' | 'OPTED_OUT';

export interface RecallRule {
  id: string;
  tenantId: string;
  clinicalServiceId: string | null;
  intervalDays: number;
  eligibilityExpr: Record<string, unknown> | unknown;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PatientRecallInstance {
  id: string;
  tenantId: string;
  patientId: string;
  ruleId: string;
  dueAt: string;
  status: PatientRecallStatus;
  lastQualifyingServiceAt: string | null;
  snoozedUntil: string | null;
  appointmentId: string | null;
  completedAt: string | null;
  optedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAppointmentsParams {
  q?: string;
  status?: AppointmentStatus;
  branchId?: string;
  providerId?: string;
  patientId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export type QueueTicketStatus = 'waiting' | 'serving' | 'completed' | 'skipped';

export interface QueueTicket {
  queueTicketId: string;
  tenantId: string;
  branchId: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: QueueTicketStatus;
  createdAt: string;
  updatedAt: string;
}

export type CalendarViewMode = 'day' | 'week' | 'month' | 'resource' | 'timeline' | 'list';

export interface ScheduleDayHours {
  dayOfWeek: number;
  openHour: number;
  openMin: number;
  closeHour: number;
  closeMin: number;
  isClosed: boolean;
}

export interface ProviderScheduleDay {
  dayOfWeek: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  isOff: boolean;
}

export interface SchedulingContext {
  timezone: string;
  locale: string;
  tenantId: string;
  branchId: string | null;
}
