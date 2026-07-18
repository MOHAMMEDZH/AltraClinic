import { LoyaltyTier, LoyaltyTierName } from '../value-objects/tier.vo';

export class LoyaltyTierService {
  private static readonly tiers: LoyaltyTier[] = [
    new LoyaltyTier('Bronze', 0, 500, ['standard support'], 0),
    new LoyaltyTier('Silver', 500, 2000, ['early booking', '5% discount'], 5),
    new LoyaltyTier('Gold', 2000, null, ['priority booking', '10% discount', 'exclusive offers'], 10),
  ];

  static resolveTier(pointsBalance: number): LoyaltyTier {
    const tier = this.tiers.find((candidate) => candidate.qualifiesFor(pointsBalance));
    if (!tier) {
      return this.tiers[0];
    }
    return tier;
  }

  static getAllTiers(): LoyaltyTier[] {
    return [...this.tiers];
  }

  static findTierByName(name: LoyaltyTierName): LoyaltyTier | null {
    return this.tiers.find((tier) => tier.name === name) ?? null;
  }
}
