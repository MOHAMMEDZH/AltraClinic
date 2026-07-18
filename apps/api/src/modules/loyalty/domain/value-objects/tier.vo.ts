import { LoyaltyValidationException } from '../exceptions/loyalty-validation.exception';

export type LoyaltyTierName = 'Bronze' | 'Silver' | 'Gold';

export class LoyaltyTier {
  public readonly name: LoyaltyTierName;
  public readonly minPoints: number;
  public readonly maxPoints: number | null;
  public readonly benefits: string[];
  public readonly discountPercent: number;

  constructor(
    name: LoyaltyTierName,
    minPoints: number,
    maxPoints: number | null,
    benefits: string[],
    discountPercent: number,
  ) {
    if (!name?.trim()) throw new LoyaltyValidationException('Tier name is required');
    if (!Number.isFinite(minPoints) || minPoints < 0) throw new LoyaltyValidationException('Tier minPoints must be non-negative');
    if (maxPoints != null && (!Number.isFinite(maxPoints) || maxPoints < minPoints)) {
      throw new LoyaltyValidationException('Tier maxPoints must be null or greater than minPoints');
    }
    if (!Array.isArray(benefits)) throw new LoyaltyValidationException('Tier benefits are required');
    if (!Number.isFinite(discountPercent) || discountPercent < 0) {
      throw new LoyaltyValidationException('Tier discount percent must be non-negative');
    }

    this.name = name;
    this.minPoints = minPoints;
    this.maxPoints = maxPoints;
    this.benefits = benefits;
    this.discountPercent = discountPercent;
  }

  qualifiesFor(pointsBalance: number): boolean {
    if (!Number.isFinite(pointsBalance) || pointsBalance < 0) return false;
    const meetsMinimum = pointsBalance >= this.minPoints;
    const belowMaximum = this.maxPoints == null || pointsBalance < this.maxPoints;
    return meetsMinimum && belowMaximum;
  }

  getBenefitDescription(): string {
    return `${this.name} tier: ${this.discountPercent}% discount, benefits: ${this.benefits.join(', ')}`;
  }

  toJSON() {
    return {
      name: this.name,
      minPoints: this.minPoints,
      maxPoints: this.maxPoints,
      benefits: this.benefits,
      discountPercent: this.discountPercent,
    };
  }
}
