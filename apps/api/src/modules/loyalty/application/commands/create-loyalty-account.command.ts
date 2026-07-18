export class CreateLoyaltyAccountCommand {
  constructor(
    public readonly patientId: string,
    public readonly clinicId: string,
    public readonly initialPoints?: number,
  ) {}
}
