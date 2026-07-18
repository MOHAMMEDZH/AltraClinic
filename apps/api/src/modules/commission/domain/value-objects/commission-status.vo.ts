import { CommissionValidationException } from '../exceptions/commission-validation.exception';

export type CommissionStatusType = 'draft' | 'calculated' | 'approved' | 'paid' | 'disputed';

export class CommissionStatus {
  public readonly status: CommissionStatusType;
  public readonly lastUpdatedAt: Date;
  public readonly reason: string | null;

  constructor(status: CommissionStatusType, reason?: string | null) {
    const allowed = new Set<CommissionStatusType>(['draft', 'calculated', 'approved', 'paid', 'disputed']);
    if (!allowed.has(status)) {
      throw new CommissionValidationException(`Invalid commission status: ${status}`);
    }

    if (status === 'disputed' && (!reason || !reason.trim())) {
      throw new CommissionValidationException('A dispute reason is required when status is disputed');
    }

    this.status = status;
    this.reason = status === 'disputed' ? reason?.trim() ?? null : null;
    this.lastUpdatedAt = new Date();
  }

  canApprove(): boolean {
    return this.status === 'calculated';
  }

  canPay(): boolean {
    return this.status === 'approved';
  }

  canDispute(): boolean {
    return this.status === 'calculated' || this.status === 'approved';
  }

  isPaid(): boolean {
    return this.status === 'paid';
  }

  isDisputed(): boolean {
    return this.status === 'disputed';
  }

  toJSON() {
    return {
      status: this.status,
      reason: this.reason,
      lastUpdatedAt: this.lastUpdatedAt.toISOString(),
    };
  }
}
