import { randomUUID } from 'crypto';
import { LoyaltyPoints } from '../value-objects/loyalty-points.vo';
import { LoyaltyTier } from '../value-objects/tier.vo';
import { LoyaltyTransaction } from './loyalty-transaction.entity';
import { LoyaltyValidationException } from '../exceptions/loyalty-validation.exception';
import { LoyaltyTierService } from '../services/loyalty-tier.service';

export interface LoyaltyAccountProps {
  accountId: string;
  tenantId: string;
  patientId: string;
  clinicId: string;
  points: LoyaltyPoints;
  tier: LoyaltyTier;
  enrollmentDate: Date;
  lastActivityDate: Date;
  isActive: boolean;
  transactions: LoyaltyTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export class LoyaltyAccount {
  public readonly accountId: string;
  public readonly tenantId: string;
  public readonly patientId: string;
  public readonly clinicId: string;
  public points: LoyaltyPoints;
  public tier: LoyaltyTier;
  public readonly enrollmentDate: Date;
  public lastActivityDate: Date;
  public isActive: boolean;
  private transactionsValue: LoyaltyTransaction[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: LoyaltyAccountProps) {
    this.accountId = props.accountId;
    this.tenantId = props.tenantId;
    this.patientId = props.patientId;
    this.clinicId = props.clinicId;
    this.points = props.points;
    this.tier = props.tier;
    this.enrollmentDate = props.enrollmentDate;
    this.lastActivityDate = props.lastActivityDate;
    this.isActive = props.isActive;
    this.transactionsValue = props.transactions;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get transactions(): LoyaltyTransaction[] {
    return [...this.transactionsValue];
  }

  /** Reconstitutes a LoyaltyAccount from persistence. */
  static restore(props: LoyaltyAccountProps): LoyaltyAccount {
    return new LoyaltyAccount(props);
  }

  static create(input: {
    tenantId: string;
    patientId: string;
    clinicId: string;
    initialPoints?: number;
    tier: LoyaltyTier;
  }): LoyaltyAccount {
    if (!input.tenantId?.trim()) throw new LoyaltyValidationException('Tenant ID is required');
    if (!input.patientId?.trim()) throw new LoyaltyValidationException('Patient ID is required');
    if (!input.clinicId?.trim()) throw new LoyaltyValidationException('Clinic ID is required');

    const points = new LoyaltyPoints(input.initialPoints ?? 0);
    const account = new LoyaltyAccount({
      accountId: randomUUID(),
      tenantId: input.tenantId,
      patientId: input.patientId,
      clinicId: input.clinicId,
      points,
      tier: input.tier,
      enrollmentDate: new Date(),
      lastActivityDate: new Date(),
      isActive: true,
      transactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return account;
  }

  earnPoints(pointsEarned: number, reference: string | null, description: string | null): LoyaltyTransaction {
    if (!this.isActive) {
      throw new LoyaltyValidationException('Cannot earn points on inactive loyalty account');
    }

    const transaction = LoyaltyTransaction.create({
      accountId: this.accountId,
      type: 'earn',
      pointsAmount: pointsEarned,
      reference,
      description,
    });

    this.points = this.points.add(pointsEarned);
    this.transactionsValue.push(transaction);
    this.lastActivityDate = new Date();
    this.tier = this.calculateTier(this.points.balance);
    this.updatedAt = new Date();

    return transaction;
  }

  redeemPoints(pointsRedeemed: number, reference: string | null, description: string | null): LoyaltyTransaction {
    if (!this.isActive) {
      throw new LoyaltyValidationException('Cannot redeem points on inactive loyalty account');
    }
    if (!this.points.canRedeem(pointsRedeemed)) {
      throw new LoyaltyValidationException('Insufficient loyalty points for redemption');
    }

    const transaction = LoyaltyTransaction.create({
      accountId: this.accountId,
      type: 'redeem',
      pointsAmount: pointsRedeemed,
      reference,
      description,
    });

    this.points = this.points.subtract(pointsRedeemed);
    this.transactionsValue.push(transaction);
    this.lastActivityDate = new Date();
    this.tier = this.calculateTier(this.points.balance);
    this.updatedAt = new Date();

    return transaction;
  }

  suspend(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.updatedAt = new Date();
  }

  reactivate(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.updatedAt = new Date();
  }

  private calculateTier(pointsBalance: number): LoyaltyTier {
    return LoyaltyTierService.resolveTier(pointsBalance);
  }

  toJSON() {
    return {
      accountId: this.accountId,
      tenantId: this.tenantId,
      patientId: this.patientId,
      clinicId: this.clinicId,
      points: this.points.toJSON(),
      tier: this.tier.toJSON(),
      enrollmentDate: this.enrollmentDate.toISOString(),
      lastActivityDate: this.lastActivityDate.toISOString(),
      isActive: this.isActive,
      transactions: this.transactionsValue.map((t) => t.toJSON()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
