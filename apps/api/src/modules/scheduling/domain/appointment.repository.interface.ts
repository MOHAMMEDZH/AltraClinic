import { Appointment } from './appointment.entity';
import { TimeSlotVO } from './timeslot.vo';
import type { AppointmentDetail, AppointmentListFilter, AppointmentListItem } from './scheduling.types';

export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(id: string, tenantId: string): Promise<Appointment | null>;
  findDetailById(id: string, tenantId: string): Promise<AppointmentDetail | null>;
  findByProviderAndSlot(
    providerId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null>;
  findByResourceAndSlot(
    resourceId: string,
    slot: TimeSlotVO,
    tenantId: string,
    excludeId?: string,
  ): Promise<Appointment | null>;
  list(filter: AppointmentListFilter): Promise<{ items: AppointmentListItem[]; total: number }>;
  /**
   * Authoritative series future-peer discovery (no arbitrary truncation).
   * Ordered by scheduledStart ASC, id ASC. Pages until exhausted when pageSize set.
   */
  listSeriesFutureMembers(params: {
    tenantId: string;
    recurrenceSeriesId: string;
    fromScheduledStart: string | Date;
    /** Test-only page size; production omits → unbounded page (all rows). */
    pageSize?: number;
  }): Promise<AppointmentListItem[]>;
  updateNotes(id: string, tenantId: string, notes: string | null): Promise<void>;
  softDelete(id: string, tenantId: string): Promise<boolean>;
}
