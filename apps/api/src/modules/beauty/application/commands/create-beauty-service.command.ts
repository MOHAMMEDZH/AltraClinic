export interface CreateBeautyServiceCommand {
  patientId: string;
  clinicianId: string;
  serviceType: string;
  scheduledAt: string; // ISO string
  notesEn?: string | null;
  notesAr?: string | null;
  correlationId?: string | null;
}
