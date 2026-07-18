export class CreateCommissionRuleCommand {
  constructor(
    public readonly providerId: string | null,
    public readonly serviceType: string | null,
    public readonly commissionRateType: 'percentage' | 'fixed_amount',
    public readonly commissionRateValue: number,
    public readonly minimumThreshold: number | null,
    public readonly maximumCap: number | null,
    public readonly effectiveDate: string,
    public readonly expiryDate: string | null,
  ) {}
}
