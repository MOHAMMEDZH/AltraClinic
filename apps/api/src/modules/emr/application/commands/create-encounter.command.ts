export class CreateEncounterCommand {
  constructor(
    public readonly patientId: string,
    public readonly clinicianId: string,
    public readonly diagnoses: { code: string; description: string }[] = [],
    public readonly medications: { name: string; dose?: string; route?: string; frequency?: string }[] = [],
    public readonly observations: { type: string; value: string; unit?: string }[] = [],
    public readonly chiefComplaint?: string | null,
    public readonly clinicalNotes?: string | null,
    public readonly appointmentId?: string | null,
    public readonly followUpDate?: string | null,
  ) {}
}
