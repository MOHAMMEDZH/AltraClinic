export class EarnLoyaltyPointsCommand {
  constructor(
    public readonly accountId: string,
    public readonly pointsToEarn: number,
    public readonly reference?: string | null,
    public readonly description?: string | null,
  ) {}
}
