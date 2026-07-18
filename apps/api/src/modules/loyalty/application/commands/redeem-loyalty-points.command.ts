export class RedeemLoyaltyPointsCommand {
  constructor(
    public readonly accountId: string,
    public readonly pointsToRedeem: number,
    public readonly rewardId?: string | null,
    public readonly reference?: string | null,
  ) {}
}
