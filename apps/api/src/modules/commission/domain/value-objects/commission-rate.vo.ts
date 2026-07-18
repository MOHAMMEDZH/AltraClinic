import { CommissionValidationException } from '../exceptions/commission-validation.exception';

export type CommissionRateType = 'percentage' | 'fixed_amount';

export class CommissionRate {
  public readonly type: CommissionRateType;
  public readonly value: number;
  public readonly minimumThreshold: number | null;
  public readonly maximumCap: number | null;

  constructor(
    type: CommissionRateType,
    value: number,
    minimumThreshold?: number | null,
    maximumCap?: number | null,
  ) {
    const allowed = new Set<CommissionRateType>(['percentage', 'fixed_amount']);
    if (!allowed.has(type)) {
      throw new CommissionValidationException(`Invalid commission rate type: ${type}`);
    }
    if (value < 0) {
      throw new CommissionValidationException('Commission rate value must be greater than or equal to zero');
    }
    if (minimumThreshold != null && minimumThreshold < 0) {
      throw new CommissionValidationException('Minimum threshold must be greater than or equal to zero');
    }
    if (maximumCap != null && maximumCap < 0) {
      throw new CommissionValidationException('Maximum cap must be greater than or equal to zero');
    }
    if (minimumThreshold != null && maximumCap != null && maximumCap < minimumThreshold) {
      throw new CommissionValidationException('Maximum cap cannot be less than minimum threshold');
    }

    this.type = type;
    this.value = value;
    this.minimumThreshold = minimumThreshold ?? null;
    this.maximumCap = maximumCap ?? null;
  }

  calculateAmount(baseAmount: number): number {
    if (baseAmount < 0) {
      throw new CommissionValidationException('Base amount must be greater than or equal to zero');
    }

    let calculated = 0;
    if (this.type === 'percentage') {
      calculated = (baseAmount * this.value) / 100;
    } else {
      calculated = this.value;
    }

    if (this.minimumThreshold != null && baseAmount < this.minimumThreshold) {
      return 0;
    }

    if (this.maximumCap != null) {
      calculated = Math.min(calculated, this.maximumCap);
    }

    return Number(calculated.toFixed(2));
  }

  toJSON() {
    return {
      type: this.type,
      value: this.value,
      minimumThreshold: this.minimumThreshold,
      maximumCap: this.maximumCap,
    };
  }
}
