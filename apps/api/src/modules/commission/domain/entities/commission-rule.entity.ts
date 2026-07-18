import { randomUUID } from 'crypto';
import { CommissionRate } from '../value-objects/commission-rate.vo';
import { CommissionValidationException } from '../exceptions/commission-validation.exception';

export interface CommissionRuleProps {
  ruleId: string;
  tenantId: string;
  providerId?: string | null;
  serviceType?: string | null;
  commissionRate: CommissionRate;
  effectiveDate: Date;
  expiryDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CommissionRule {
  public readonly ruleId: string;
  public readonly tenantId: string;
  public readonly providerId?: string | null;
  public readonly serviceType?: string | null;
  public readonly commissionRate: CommissionRate;
  public readonly effectiveDate: Date;
  public readonly expiryDate?: Date | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: CommissionRuleProps) {
    this.ruleId = props.ruleId;
    this.tenantId = props.tenantId;
    this.providerId = props.providerId ?? null;
    this.serviceType = props.serviceType ?? null;
    this.commissionRate = props.commissionRate;
    this.effectiveDate = props.effectiveDate;
    this.expiryDate = props.expiryDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Reconstitutes a CommissionRule from persistence. */
  static restore(props: CommissionRuleProps): CommissionRule {
    return new CommissionRule(props);
  }

  static create(input: {
    ruleId?: string;
    tenantId: string;
    providerId?: string | null;
    serviceType?: string | null;
    commissionRate: CommissionRate;
    effectiveDate: Date;
    expiryDate?: Date | null;
  }): CommissionRule {
    if (!input.tenantId?.trim()) {
      throw new CommissionValidationException('Tenant ID is required for commission rules');
    }
    if (input.providerId != null && !input.providerId.trim()) {
      throw new CommissionValidationException('Provider ID cannot be empty when provided');
    }
    if (input.serviceType != null && !input.serviceType.trim()) {
      throw new CommissionValidationException('Service type cannot be empty when provided');
    }
    if (Number.isNaN(input.effectiveDate.getTime())) {
      throw new CommissionValidationException('Commission rule effective date must be valid');
    }
    if (input.expiryDate != null && Number.isNaN(input.expiryDate.getTime())) {
      throw new CommissionValidationException('Commission rule expiry date must be valid');
    }
    if (input.expiryDate != null && input.expiryDate < input.effectiveDate) {
      throw new CommissionValidationException('Commission rule expiry date cannot be before effective date');
    }

    return new CommissionRule({
      ruleId: input.ruleId ?? randomUUID(),
      tenantId: input.tenantId,
      providerId: input.providerId ?? null,
      serviceType: input.serviceType ?? null,
      commissionRate: input.commissionRate,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  appliesTo(providerId: string, serviceType?: string | null, referenceDate: Date = new Date()): boolean {
    if (!this.isEffective(referenceDate)) return false;

    const providerMatches = this.providerId === null || this.providerId === providerId;
    const serviceTypeMatches = this.serviceType === null || this.serviceType === serviceType;
    return providerMatches && serviceTypeMatches;
  }

  isEffective(referenceDate: Date = new Date()): boolean {
    const startsBefore = this.effectiveDate <= referenceDate;
    const notExpired = this.expiryDate == null || this.expiryDate >= referenceDate;
    return startsBefore && notExpired;
  }

  calculateAmount(baseAmount: number): number {
    return this.commissionRate.calculateAmount(baseAmount);
  }

  toJSON() {
    return {
      ruleId: this.ruleId,
      tenantId: this.tenantId,
      providerId: this.providerId,
      serviceType: this.serviceType,
      commissionRate: this.commissionRate.toJSON(),
      effectiveDate: this.effectiveDate.toISOString(),
      expiryDate: this.expiryDate?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
