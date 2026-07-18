export class CreateAppointmentCommand {
  constructor(
    public readonly patientId: string,
    public readonly providerId: string,
    public readonly start: string,
    public readonly end: string,
    public readonly notes?: string,
    public readonly serviceType?: string | null,
    public readonly isEmergency?: boolean,
    public readonly recurrence?: {
      frequency: 'weekly' | 'biweekly' | 'monthly';
      occurrences: number;
    },
    public readonly resourceId?: string | null,
  ) {}
}
