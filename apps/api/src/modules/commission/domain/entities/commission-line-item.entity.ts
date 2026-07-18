import { randomUUID } from 'crypto';
import { CommissionRate, CommissionRateType } from '../value-objects/commission-rate.vo';
import { CommissionValidationException } from '../exceptions/commission-validation.exception';

export interface CommissionLineItemProps {
  itemId: string;
  commissionId: string;
  appointmentId: string | null;
  serviceDescription: string;
  serviceType: string | null;
  amount: number;
  commissionRate: CommissionRate;
  commissionAmount: number;
  date: Date;
}

export class CommissionLineItem {
  public readonly itemId: string;
  public readonly commissionId: string;
  public readonly appointmentId: string | null;
  public readonly serviceDescription: string;
  public readonly serviceType: string | null;
  public readonly amount: number;
  public readonly commissionRate: CommissionRate;
  public readonly commissionAmount: number;
  public readonly date: Date;

  private constructor(props: CommissionLineItemProps) {
    this.itemId = props.itemId;
    this.commissionId = props.commissionId;
    this.appointmentId = props.appointmentId;
    this.serviceDescription = props.serviceDescription;
    this.serviceType = props.serviceType;
    this.amount = props.amount;
    this.commissionRate = props.commissionRate;
    this.commissionAmount = props.commissionAmount;
    this.date = props.date;
  }

  /** Reconstitutes a CommissionLineItem from persistence. */
  static restore(props: CommissionLineItemProps): CommissionLineItem {
    return new CommissionLineItem(props);
  }

  static create(input: {
    commissionId: string;
    appointmentId?: string | null;
    serviceDescription: string;
    serviceType?: string | null;
    amount: number;
    commissionRateType: CommissionRateType;
    commissionRateValue: number;
    minimumThreshold?: number | null;
    maximumCap?: number | null;
    date: Date;
  }): CommissionLineItem {
    if (!input.serviceDescription?.trim()) {
      throw new CommissionValidationException('Service description is required for commission line items');
    }
    if (input.amount < 0) {
      throw new CommissionValidationException('Line item amount must be greater than or equal to zero');
    }

    const rate = new CommissionRate(
      input.commissionRateType,
      input.commissionRateValue,
      input.minimumThreshold ?? null,
      input.maximumCap ?? null,
    );

    const commissionAmount = rate.calculateAmount(input.amount);

    return new CommissionLineItem({
      itemId: randomUUID(),
      commissionId: input.commissionId,
      appointmentId: input.appointmentId ?? null,
      serviceDescription: input.serviceDescription,
      serviceType: input.serviceType ?? null,
      amount: input.amount,
      commissionRate: rate,
      commissionAmount,
      date: input.date,
    });
  }

  toJSON() {
    return {
      itemId: this.itemId,
      commissionId: this.commissionId,
      appointmentId: this.appointmentId,
      serviceDescription: this.serviceDescription,
      serviceType: this.serviceType,
      amount: this.amount,
      commissionRate: this.commissionRate.toJSON(),
      commissionAmount: this.commissionAmount,
      date: this.date.toISOString(),
    };
  }
}
