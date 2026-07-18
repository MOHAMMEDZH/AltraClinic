export class CreateSubscriptionCommand {
  constructor(
    public readonly customerId: string,
    public readonly plan: string,
    public readonly currency: string,
    public readonly startDate: string,
    public readonly endDate: string | null,
    public readonly autoRenew: boolean,
    public readonly branchId: string | null,
    public readonly createdBy: string,
  ) {}
}
