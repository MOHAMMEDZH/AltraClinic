/**
 * DimensionFilter Value Object
 * Represents filters for analytics queries (by provider, clinic, service type, etc.)
 */
export interface DimensionFilterProps {
  clinicId?: string;
  branchId?: string;
  providerId?: string;
  serviceType?: string;
  specialization?: string;
  patientSegment?: string; // e.g., new, returning, vip
  paymentMethod?: string;
  appointmentStatus?: string;
  timeZone?: string;
}

export class DimensionFilter {
  readonly clinicId: string | undefined;
  readonly branchId: string | undefined;
  readonly providerId: string | undefined;
  readonly serviceType: string | undefined;
  readonly specialization: string | undefined;
  readonly patientSegment: string | undefined;
  readonly paymentMethod: string | undefined;
  readonly appointmentStatus: string | undefined;
  readonly timeZone: string | undefined;

  private constructor(props: DimensionFilterProps) {
    this.clinicId = props.clinicId;
    this.branchId = props.branchId;
    this.providerId = props.providerId;
    this.serviceType = props.serviceType;
    this.specialization = props.specialization;
    this.patientSegment = props.patientSegment;
    this.paymentMethod = props.paymentMethod;
    this.appointmentStatus = props.appointmentStatus;
    this.timeZone = props.timeZone;
  }

  static create(props: DimensionFilterProps): DimensionFilter {
    // Validate all provided values
    Object.values(props).forEach((value) => {
      if (typeof value === 'string' && !value.trim()) {
        throw new Error('Filter values must be non-empty strings');
      }
    });

    return new DimensionFilter(props);
  }

  static empty(): DimensionFilter {
    return new DimensionFilter({});
  }

  static fromJSON(json: DimensionFilterProps): DimensionFilter {
    return DimensionFilter.create(json ?? {});
  }

  isEmpty(): boolean {
    return Object.values(this).every((v) => v === undefined);
  }

  merge(other: DimensionFilter): DimensionFilter {
    return DimensionFilter.create({
      clinicId: this.clinicId ?? other.clinicId,
      branchId: this.branchId ?? other.branchId,
      providerId: this.providerId ?? other.providerId,
      serviceType: this.serviceType ?? other.serviceType,
      specialization: this.specialization ?? other.specialization,
      patientSegment: this.patientSegment ?? other.patientSegment,
      paymentMethod: this.paymentMethod ?? other.paymentMethod,
      appointmentStatus: this.appointmentStatus ?? other.appointmentStatus,
      timeZone: this.timeZone ?? other.timeZone,
    });
  }

  toJSON(): DimensionFilterProps {
    return {
      clinicId: this.clinicId,
      branchId: this.branchId,
      providerId: this.providerId,
      serviceType: this.serviceType,
      specialization: this.specialization,
      patientSegment: this.patientSegment,
      paymentMethod: this.paymentMethod,
      appointmentStatus: this.appointmentStatus,
      timeZone: this.timeZone,
    };
  }
}
