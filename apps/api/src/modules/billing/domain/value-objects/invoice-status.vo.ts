import { InvoiceValidationException } from '../exceptions/invoice-validation.exception';

export type InvoiceStatusType = 'draft' | 'issued' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled' | 'written_off';

export class InvoiceStatus {
  public readonly status: InvoiceStatusType;
  public readonly lastUpdatedAt: Date;

  constructor(status: InvoiceStatusType) {
    const allowed = new Set(['draft', 'issued', 'partial_paid', 'paid', 'overdue', 'cancelled', 'written_off']);
    if (!allowed.has(status)) {
      throw new InvoiceValidationException(`Invalid invoice status: ${status}`);
    }
    this.status = status;
    this.lastUpdatedAt = new Date();
  }

  canAddLineItems(): boolean {
    return this.status === 'draft';
  }

  canIssue(): boolean {
    return this.status === 'draft';
  }

  canCancelInvoice(): boolean {
    return ['draft', 'issued'].includes(this.status);
  }

  canMarkOverdue(): boolean {
    return this.status === 'issued' || this.status === 'partial_paid';
  }

  isPaid(): boolean {
    return this.status === 'paid';
  }

  isCancelled(): boolean {
    return this.status === 'cancelled';
  }
}
