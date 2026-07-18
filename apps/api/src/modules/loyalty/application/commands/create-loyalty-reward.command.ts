export class CreateLoyaltyRewardCommand {
  constructor(
    public readonly accountId: string,
    public readonly pointsRequired: number,
    public readonly description: string,
    public readonly metadata?: Record<string, unknown> | null,
    public readonly expiryDate?: string | null,
  ) {}
}
