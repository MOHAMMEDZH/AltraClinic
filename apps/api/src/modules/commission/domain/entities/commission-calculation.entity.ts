import { randomUUID } from 'crypto';
import { CommissionLineItem } from './commission-line-item.entity';
import { CommissionStatus } from '../value-objects/commission-status.vo';
import { CommissionRate } from '../value-objects/commission-rate.vo';
import { CommissionValidationException } from '../exceptions/commission-validation.exception';

export interface CommissionCalculationProps {
  commissionId: string;
  tenantId: string;
  branchId: string | null;
  providerId: string;
  periodStart: Date;
  periodEnd: Date;
  status: CommissionStatus;
  totalRevenue: number;
  commissionAmount: number;
  currency: string;
  basisDocumentIds: string[];
  lineItems: CommissionLineItem[];
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CommissionCalculation {
  public readonly commissionId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly providerId: string;
  public readonly periodStart: Date;
  public readonly periodEnd: Date;
  public status: CommissionStatus;
  public totalRevenue: number;
  public commissionAmount: number;
  public readonly currency: string;
  public readonly basisDocumentIds: string[];
  private lineItemsValue: CommissionLineItem[];
  public paymentMethod?: string | null;
  public paymentReference?: string | null;
  public paymentDate?: Date | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: CommissionCalculationProps) {
    this.commissionId = props.commissionId;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.providerId = props.providerId;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.status = props.status;
    this.totalRevenue = props.totalRevenue;
    this.commissionAmount = props.commissionAmount;
    this.currency = props.currency;
    this.basisDocumentIds = props.basisDocumentIds;
    this.lineItemsValue = props.lineItems;
    this.paymentMethod = props.paymentMethod ?? null;
    this.paymentReference = props.paymentReference ?? null;
    this.paymentDate = props.paymentDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lineItems(): CommissionLineItem[] {
    return [...this.lineItemsValue];
  }

  /** Reconstitutes a CommissionCalculation from persistence. */
  static restore(props: CommissionCalculationProps): CommissionCalculation {
    return new CommissionCalculation(props);
  }

  static create(input: {
    commissionId: string;
    tenantId: string;
    branchId: string | null;
    providerId: string;
    periodStart: Date;
    periodEnd: Date;
    currency?: string;
    basisDocumentIds?: string[];
    lineItems?: Array<{
      appointmentId?: string | null;
      serviceDescription: string;
      serviceType?: string | null;
      amount: number;
      commissionRateType: 'percentage' | 'fixed_amount';
      commissionRateValue: number;
      minimumThreshold?: number | null;
      maximumCap?: number | null;
      date: Date;
    }>;
  }): CommissionCalculation {
    if (!input.providerId?.trim()) {
      throw new CommissionValidationException('Provider ID is required');
    }
    if (Number.isNaN(input.periodStart.getTime()) || Number.isNaN(input.periodEnd.getTime())) {
      throw new CommissionValidationException('Invalid commission period dates');
    }
    if (input.periodEnd < input.periodStart) {
      throw new CommissionValidationException('Commission period end cannot be before start');
    }

    const lineItems = (input.lineItems ?? []).map((item) =>
      CommissionLineItem.create({
        commissionId: input.commissionId,
        appointmentId: item.appointmentId ?? null,
        serviceDescription: item.serviceDescription,
        serviceType: item.serviceType ?? null,
        amount: item.amount,
        commissionRateType: item.commissionRateType,
        commissionRateValue: item.commissionRateValue,
        minimumThreshold: item.minimumThreshold ?? null,
        maximumCap: item.maximumCap ?? null,
        date: item.date,
      }),
    );

    const totalRevenue = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const commissionAmount = lineItems.reduce((sum, li) => sum + li.commissionAmount, 0);

    return new CommissionCalculation({
      commissionId: input.commissionId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      providerId: input.providerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: new CommissionStatus('calculated'),
      totalRevenue,
      commissionAmount,
      currency: input.currency ?? 'SYP',
      basisDocumentIds: input.basisDocumentIds ?? [],
      lineItems,
      paymentMethod: null,
      paymentReference: null,
      paymentDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  approve(): void {
    if (!this.status.canApprove()) {
      throw new CommissionValidationException('Commission cannot be approved in current status');
    }
    this.status = new CommissionStatus('approved');
    this.updatedAt = new Date();
  }

  pay(paymentMethod: string, paymentReference?: string | null, paymentDate?: Date | null): void {
    if (!this.status.canPay()) {
      throw new CommissionValidationException('Commission cannot be paid in current status');
    }
    if (!paymentMethod?.trim()) {
      throw new CommissionValidationException('Payment method is required when paying a commission');
    }

    this.status = new CommissionStatus('paid');
    this.paymentMethod = paymentMethod;
    this.paymentReference = paymentReference ?? null;
    this.paymentDate = paymentDate ?? new Date();
    this.updatedAt = new Date();
  }

  dispute(reason: string): void {
    if (!this.status.canDispute()) {
      throw new CommissionValidationException('Commission cannot be disputed in current status');
    }
    this.status = new CommissionStatus('disputed', reason);
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      commissionId: this.commissionId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      providerId: this.providerId,
      periodStart: this.periodStart.toISOString(),
      periodEnd: this.periodEnd.toISOString(),
      status: this.status.toJSON(),
      totalRevenue: this.totalRevenue,
      commissionAmount: this.commissionAmount,
      currency: this.currency,
      basisDocumentIds: this.basisDocumentIds,
      lineItems: this.lineItemsValue.map((item) => item.toJSON()),
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference,
      paymentDate: this.paymentDate?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
