import { randomUUID } from 'crypto';
import { LoyaltyValidationException } from '../exceptions/loyalty-validation.exception';

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjust';

export interface LoyaltyTransactionProps {
  transactionId: string;
  accountId: string;
  type: LoyaltyTransactionType;
  pointsAmount: number;
  reference: string | null;
  description: string | null;
  transactionDate: Date;
  createdAt: Date;
}

export class LoyaltyTransaction {
  public readonly transactionId: string;
  public readonly accountId: string;
  public readonly type: LoyaltyTransactionType;
  public readonly pointsAmount: number;
  public readonly reference: string | null;
  public readonly description: string | null;
  public readonly transactionDate: Date;
  public readonly createdAt: Date;

  private constructor(props: LoyaltyTransactionProps) {
    this.transactionId = props.transactionId;
    this.accountId = props.accountId;
    this.type = props.type;
    this.pointsAmount = props.pointsAmount;
    this.reference = props.reference;
    this.description = props.description;
    this.transactionDate = props.transactionDate;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    accountId: string;
    type: LoyaltyTransactionType;
    pointsAmount: number;
    reference?: string | null;
    description?: string | null;
    transactionDate?: Date;
  }): LoyaltyTransaction {
    if (!input.accountId?.trim()) {
      throw new LoyaltyValidationException('Account ID is required for loyalty transactions');
    }
    const allowedTypes = new Set<LoyaltyTransactionType>(['earn', 'redeem', 'expire', 'adjust']);
    if (!allowedTypes.has(input.type)) {
      throw new LoyaltyValidationException('Invalid loyalty transaction type');
    }
    if (!Number.isFinite(input.pointsAmount) || input.pointsAmount <= 0) {
      throw new LoyaltyValidationException('Loyalty transaction points amount must be greater than zero');
    }

    return new LoyaltyTransaction({
      transactionId: randomUUID(),
      accountId: input.accountId,
      type: input.type,
      pointsAmount: input.pointsAmount,
      reference: input.reference ?? null,
      description: input.description?.trim() ?? null,
      transactionDate: input.transactionDate ?? new Date(),
      createdAt: new Date(),
    });
  }

  toJSON() {
    return {
      transactionId: this.transactionId,
      accountId: this.accountId,
      type: this.type,
      pointsAmount: this.pointsAmount,
      reference: this.reference,
      description: this.description,
      transactionDate: this.transactionDate.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
