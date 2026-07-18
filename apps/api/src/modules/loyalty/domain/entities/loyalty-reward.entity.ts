import { randomUUID } from 'crypto';
import { LoyaltyValidationException } from '../exceptions/loyalty-validation.exception';

export type LoyaltyRewardStatus = 'available' | 'expired' | 'redeemed';

export interface LoyaltyRewardProps {
  rewardId: string;
  tenantId: string;
  accountId: string;
  pointsRequired: number;
  description: string;
  metadata: Record<string, unknown> | null;
  expiryDate: Date | null;
  status: LoyaltyRewardStatus;
  redeemedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class LoyaltyReward {
  public readonly rewardId: string;
  public readonly tenantId: string;
  public readonly accountId: string;
  public readonly pointsRequired: number;
  public readonly description: string;
  public readonly metadata: Record<string, unknown> | null;
  public readonly expiryDate: Date | null;
  public status: LoyaltyRewardStatus;
  public redeemedDate: Date | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: LoyaltyRewardProps) {
    this.rewardId = props.rewardId;
    this.tenantId = props.tenantId;
    this.accountId = props.accountId;
    this.pointsRequired = props.pointsRequired;
    this.description = props.description;
    this.metadata = props.metadata;
    this.expiryDate = props.expiryDate;
    this.status = props.status;
    this.redeemedDate = props.redeemedDate;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Reconstitutes a LoyaltyReward from persistence. */
  static restore(props: LoyaltyRewardProps): LoyaltyReward {
    return new LoyaltyReward(props);
  }

  static create(input: {
    tenantId: string;
    accountId: string;
    pointsRequired: number;
    description: string;
    metadata?: Record<string, unknown> | null;
    expiryDate?: Date | null;
  }): LoyaltyReward {
    if (!input.tenantId?.trim()) {
      throw new LoyaltyValidationException('Tenant ID is required for loyalty rewards');
    }
    if (!input.accountId?.trim()) {
      throw new LoyaltyValidationException('Account ID is required for rewards');
    }
    if (!input.description?.trim()) {
      throw new LoyaltyValidationException('Reward description is required');
    }
    if (!Number.isFinite(input.pointsRequired) || input.pointsRequired <= 0) {
      throw new LoyaltyValidationException('Points required must be greater than zero');
    }
    if (input.expiryDate != null && Number.isNaN(input.expiryDate.getTime())) {
      throw new LoyaltyValidationException('Reward expiry date must be valid');
    }
    if (input.expiryDate != null && input.expiryDate < new Date()) {
      throw new LoyaltyValidationException('Reward expiry date must be in the future');
    }

    return new LoyaltyReward({
      rewardId: randomUUID(),
      tenantId: input.tenantId,
      accountId: input.accountId,
      pointsRequired: input.pointsRequired,
      description: input.description.trim(),
      metadata: input.metadata ?? null,
      expiryDate: input.expiryDate ?? null,
      status: 'available',
      redeemedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  canRedeem(currentPoints: number): boolean {
    if (this.status !== 'available') return false;
    if (!Number.isFinite(currentPoints) || currentPoints < this.pointsRequired) return false;
    if (this.expiryDate && this.expiryDate < new Date()) return false;
    return true;
  }

  redeem(redeemedDate?: Date): void {
    if (this.status !== 'available') {
      throw new LoyaltyValidationException('Reward is not available for redemption');
    }
    if (this.expiryDate && this.expiryDate < (redeemedDate ?? new Date())) {
      throw new LoyaltyValidationException('Reward has expired');
    }
    this.status = 'redeemed';
    this.redeemedDate = redeemedDate ?? new Date();
    this.updatedAt = new Date();
  }

  expire(): void {
    if (this.status !== 'available') return;
    this.status = 'expired';
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      rewardId: this.rewardId,
      tenantId: this.tenantId,
      accountId: this.accountId,
      pointsRequired: this.pointsRequired,
      description: this.description,
      metadata: this.metadata,
      expiryDate: this.expiryDate?.toISOString() ?? null,
      status: this.status,
      redeemedDate: this.redeemedDate?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
