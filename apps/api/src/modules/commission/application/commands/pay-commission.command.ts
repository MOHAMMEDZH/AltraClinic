export class PayCommissionCommand {
  constructor(
    public readonly commissionId: string,
    public readonly paymentMethod: string,
    public readonly paymentReference: string | null,
    public readonly paymentDate: string | null,
  ) {}
}
