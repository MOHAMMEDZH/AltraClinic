import { LoyaltyValidationException } from '../exceptions/loyalty-validation.exception';

export class LoyaltyPoints {
  public readonly balance: number;
  public readonly currencyUnit: string;

  constructor(balance: number, currencyUnit: string = 'point') {
    if (!Number.isFinite(balance) || balance < 0) {
      throw new LoyaltyValidationException('Loyalty points balance must be a non-negative number');
    }
    if (!currencyUnit?.trim()) {
      throw new LoyaltyValidationException('Loyalty points currency unit is required');
    }
    this.balance = balance;
    this.currencyUnit = currencyUnit.trim();
  }

  add(points: number): LoyaltyPoints {
    if (!Number.isFinite(points) || points <= 0) {
      throw new LoyaltyValidationException('Points to add must be greater than zero');
    }
    return new LoyaltyPoints(this.balance + points, this.currencyUnit);
  }

  subtract(points: number): LoyaltyPoints {
    if (!Number.isFinite(points) || points <= 0) {
      throw new LoyaltyValidationException('Points to subtract must be greater than zero');
    }
    if (points > this.balance) {
      throw new LoyaltyValidationException('Insufficient loyalty points');
    }
    return new LoyaltyPoints(this.balance - points, this.currencyUnit);
  }

  canRedeem(points: number): boolean {
    return Number.isFinite(points) && points > 0 && points <= this.balance;
  }

  toJSON() {
    return {
      balance: this.balance,
      currencyUnit: this.currencyUnit,
    };
  }
}
