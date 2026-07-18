export class ListSubscriptionsQuery {
  constructor(
    public readonly branchId: string | null,
    public readonly customerId: string | null,
    public readonly status: string | null,
    public readonly plan: string | null,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
