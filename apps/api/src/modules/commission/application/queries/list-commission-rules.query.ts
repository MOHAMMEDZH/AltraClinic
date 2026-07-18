export class ListCommissionRulesQuery {
  constructor(
    public readonly providerId: string | null,
    public readonly serviceType: string | null,
  ) {}
}
