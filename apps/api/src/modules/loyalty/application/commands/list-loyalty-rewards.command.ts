export class ListLoyaltyRewardsCommand {
  constructor(
    public readonly accountId?: string | null,
    public readonly onlyAvailable?: boolean,
  ) {}
}
