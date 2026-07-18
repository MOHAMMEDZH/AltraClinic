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
  updateNotes(id: string, tenantId: string, notes: string | null): Promise<void>;
  softDelete(id: string, tenantId: string): Promise<boolean>;
}
