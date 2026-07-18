import { LocalizedText } from '../value-objects/localized-text.vo';
import { randomUUID } from 'crypto';

export interface BeautyServiceProps {
  serviceId: string;
  patientId: string;
  clinicianId: string;
  serviceType: string;
  scheduledAt: Date;
  notes?: LocalizedText | null;
  createdAt: Date;
}

export class BeautyService {
  public readonly serviceId: string;
  public readonly patientId: string;
  public readonly clinicianId: string;
  public readonly serviceType: string;
  public readonly scheduledAt: Date;
  public readonly notes?: LocalizedText | null;
  public readonly createdAt: Date;

  private constructor(props: BeautyServiceProps) {
    this.serviceId = props.serviceId;
    this.patientId = props.patientId;
    this.clinicianId = props.clinicianId;
    this.serviceType = props.serviceType;
    this.scheduledAt = props.scheduledAt;
    this.notes = props.notes ?? null;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    patientId: string;
    clinicianId: string;
    serviceType: string;
    scheduledAt: Date;
    notesEn?: string | null;
    notesAr?: string | null;
  }): BeautyService {
    const id = typeof randomUUID === 'function' ? randomUUID() : `bsvc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const notes = input.notesEn || input.notesAr ? new LocalizedText(input.notesEn ?? null, input.notesAr ?? null) : null;
    return new BeautyService({
      serviceId: id,
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      serviceType: input.serviceType,
      scheduledAt: input.scheduledAt,
      notes,
      createdAt: new Date(),
    });
  }
}
