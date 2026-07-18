export class CreateTreatmentCommand {
  constructor(
    public readonly patientId: string,
    public readonly providerId: string,
    public readonly procedures: Array<{ code: string; description: string; toothNumbers: number[] }>,
    public readonly notes?: string | null,
  ) {}
}
