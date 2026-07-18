import { randomUUID } from 'crypto';
import { SubscriptionPlanVO } from '../value-objects/subscription-plan.vo';
import { SubscriptionStatusVO } from '../value-objects/subscription-status.vo';
import { SubscriptionCreatedEvent } from '../events/subscription-created.event';
import { SubscriptionCanceledEvent } from '../events/subscription-canceled.event';
import { SubscriptionDomainError } from '../exceptions/subscription-domain.exception';

export interface SubscriptionProps {
  subscriptionId: string;
  tenantId: string;
  branchId?: string | null;
  customerId: string;
  plan: SubscriptionPlanVO;
  status: SubscriptionStatusVO;
  startDate: Date;
  endDate: Date | null;
  autoRenew: boolean;
  currency: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription {
  private readonly props: SubscriptionProps;

  private constructor(props: SubscriptionProps) {
    this.props = props;
  }

  /** Reconstitutes a Subscription from persistence. */
  static restore(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  static create(params: Omit<SubscriptionProps, 'subscriptionId' | 'createdAt' | 'updatedAt' | 'status'>): Subscription {
    const now = new Date();
    const plan = new SubscriptionPlanVO(params.plan.value);
    const status = new SubscriptionStatusVO('active');
    if (!params.customerId?.trim()) {
      throw new SubscriptionDomainError('Customer ID is required');
    }
    if (!params.currency?.trim()) {
      throw new SubscriptionDomainError('Currency is required');
    }
    if (!params.createdBy?.trim()) {
      throw new SubscriptionDomainError('CreatedBy is required');
    }
    return new Subscription({
      subscriptionId: randomUUID(),
      tenantId: params.tenantId,
      branchId: params.branchId ?? null,
      customerId: params.customerId.trim(),
      plan,
      status,
      startDate: params.startDate,
      endDate: params.endDate,
      autoRenew: params.autoRenew,
      currency: params.currency.trim(),
      createdBy: params.createdBy.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string {
    return this.props.subscriptionId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get branchId(): string | null {
    return this.props.branchId ?? null;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get plan(): SubscriptionPlanVO {
    return this.props.plan;
  }

  get status(): SubscriptionStatusVO {
    return this.props.status;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get autoRenew(): boolean {
    return this.props.autoRenew;
  }

  get currency(): string {
    return this.props.currency;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  cancel(userId: string, canceledAt: Date = new Date()): void {
    if (this.props.status.value === 'canceled') {
      throw new SubscriptionDomainError('Subscription is already canceled');
    }
    this.props.status = new SubscriptionStatusVO('canceled');
    this.props.endDate = canceledAt;
    this.props.updatedAt = new Date();
  }

  toPrimitives(): SubscriptionProps {
    return { ...this.props };
  }
}
