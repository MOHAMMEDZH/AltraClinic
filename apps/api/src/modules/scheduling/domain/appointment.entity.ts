import { TimeSlotVO } from './timeslot.vo';
import { AppointmentStatus } from './appointment-status.enum';

export class Appointment {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date | null = null;
  public notes: string | null = null;
  public cancellationReason: string | null = null;
  public serviceType: string | null = null;
  public isEmergency = false;
  public recurrenceSeriesId: string | null = null;
  public resourceId: string | null = null;

  constructor(
    id: string,
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public patientId: string,
    public providerId: string,
    public slot: TimeSlotVO,
    public status: AppointmentStatus = AppointmentStatus.Pending,
    createdAt?: Date,
    notes?: string | null,
    cancellationReason?: string | null,
    serviceType?: string | null,
    isEmergency?: boolean,
    recurrenceSeriesId?: string | null,
    resourceId?: string | null,
  ) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
    this.notes = notes ?? null;
    this.cancellationReason = cancellationReason ?? null;
    this.serviceType = serviceType ?? null;
    this.isEmergency = isEmergency ?? false;
    this.recurrenceSeriesId = recurrenceSeriesId ?? null;
    this.resourceId = resourceId ?? null;
  }

  confirm() {
    this.status = AppointmentStatus.Confirmed;
    this.updatedAt = new Date();
  }

  checkIn() {
    if (
      this.status === AppointmentStatus.Cancelled ||
      this.status === AppointmentStatus.Completed ||
      this.status === AppointmentStatus.NoShow
    ) {
      return;
    }
    this.status = AppointmentStatus.CheckedIn;
    this.updatedAt = new Date();
  }

  startVisit() {
    if (
      this.status === AppointmentStatus.Cancelled ||
      this.status === AppointmentStatus.Completed ||
      this.status === AppointmentStatus.NoShow
    ) {
      return;
    }
    this.status = AppointmentStatus.InProgress;
    this.updatedAt = new Date();
  }

  cancel(reason?: string | null) {
    this.status = AppointmentStatus.Cancelled;
    if (reason?.trim()) this.cancellationReason = reason.trim();
    this.updatedAt = new Date();
  }

  complete() {
    this.status = AppointmentStatus.Completed;
    this.updatedAt = new Date();
  }

  markNoShow() {
    this.status = AppointmentStatus.NoShow;
    this.updatedAt = new Date();
  }

  reschedule(slot: TimeSlotVO) {
    (this as { slot: TimeSlotVO }).slot = slot;
    this.updatedAt = new Date();
  }
}
