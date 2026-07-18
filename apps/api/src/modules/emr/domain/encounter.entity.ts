import { DiagnosisVO } from './diagnosis.vo';
import { MedicationVO } from './medication.vo';
import { ObservationVO } from './observation.vo';

export class Encounter {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date | null = null;

  constructor(
    id: string,
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public patientId: string,
    public clinicianId: string,
    public diagnoses: DiagnosisVO[] = [],
    public medications: MedicationVO[] = [],
    public observations: ObservationVO[] = [],
    createdAt?: Date,
    public chiefComplaint: string | null = null,
    public appointmentId: string | null = null,
    public followUpDate: Date | null = null,
  ) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
  }

  addDiagnosis(d: DiagnosisVO) {
    this.diagnoses.push(d);
    this.updatedAt = new Date();
  }

  addMedication(m: MedicationVO) {
    this.medications.push(m);
    this.updatedAt = new Date();
  }

  addObservation(o: ObservationVO) {
    this.observations.push(o);
    this.updatedAt = new Date();
  }
}
