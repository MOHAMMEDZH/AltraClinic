import { randomUUID } from 'crypto';
import { InvoiceStatus } from '../value-objects/invoice-status.vo';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { InvoiceValidationException } from '../exceptions/invoice-validation.exception';

export interface InvoiceProps {
  invoiceId: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  currency: string;
  notes: string | null;
  lineItems: InvoiceLineItem[];
  status: InvoiceStatus;
  amountSubtotal: number;
  amountDiscount: number;
  amountTax: number;
  amountTotal: number;
  amountPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Invoice {
  public readonly invoiceId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly patientId: string;
  public readonly invoiceNumber: string;
  public readonly invoiceDate: Date;
  public readonly dueDate: Date | null;
  public readonly currency: string;
  public readonly notes: string | null;
  private lineItemsValue: InvoiceLineItem[];
  public status: InvoiceStatus;
  public amountSubtotal: number;
  public amountDiscount: number;
  public amountTax: number;
  public amountTotal: number;
  public amountPaid: number;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private constructor(props: InvoiceProps) {
    this.invoiceId = props.invoiceId;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.patientId = props.patientId;
    this.invoiceNumber = props.invoiceNumber;
    this.invoiceDate = props.invoiceDate;
    this.dueDate = props.dueDate;
    this.currency = props.currency;
    this.notes = props.notes;
    this.lineItemsValue = props.lineItems;
    this.status = props.status;
    this.amountSubtotal = props.amountSubtotal;
    this.amountDiscount = props.amountDiscount;
    this.amountTax = props.amountTax;
    this.amountTotal = props.amountTotal;
    this.amountPaid = props.amountPaid;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lineItems(): InvoiceLineItem[] {
    return [...this.lineItemsValue];
  }

  get amountDue(): number {
    return Math.max(0, this.amountTotal - this.amountPaid);
  }

  /** Reconstitutes an Invoice aggregate from a persistence record. Skips all
   *  business-rule validation — the data is assumed to be already valid since
   *  it was stored via {@link create} or a prior save. */
  static restore(props: InvoiceProps): Invoice {
    return new Invoice(props);
  }

  static create(input: {
    invoiceId: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate?: Date | null;
    currency?: string;
    notes?: string | null;
    lineItems?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      taxPercent?: number;
      /** Server-derived ServicePerformance attribution (Wave F Round 3). */
      servicePerformanceId?: string | null;
      /** Wave F Round 4 — server-authored durable provenance. */
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      snapshotRevisionId?: string | null;
      courseSessionId?: string | null;
    }>;
  }): Invoice {
    if (!input.patientId.trim()) throw new InvoiceValidationException('Patient ID is required');
    if (!input.invoiceNumber.trim()) throw new InvoiceValidationException('Invoice number is required');
    if (Number.isNaN(input.invoiceDate.getTime())) throw new InvoiceValidationException('Invoice date is invalid');
    if (input.dueDate && Number.isNaN(input.dueDate.getTime())) throw new InvoiceValidationException('Due date is invalid');
    if (input.dueDate && input.dueDate < input.invoiceDate) {
      throw new InvoiceValidationException('Due date cannot be earlier than invoice date');
    }
    const lineItems = (input.lineItems ?? []).map((li) => InvoiceLineItem.create({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discountPercent: li.discountPercent ?? 0,
      taxPercent: li.taxPercent ?? 0,
      servicePerformanceId: li.servicePerformanceId ?? null,
      appointmentId: li.appointmentId ?? null,
      clinicalServiceId: li.clinicalServiceId ?? null,
      snapshotRevisionId: li.snapshotRevisionId ?? null,
      courseSessionId: li.courseSessionId ?? null,
    }));

    const amountSubtotal = Invoice.calculateSubtotal(lineItems);
    const amountDiscount = Invoice.calculateDiscount(lineItems);
    const amountTax = Invoice.calculateTax(lineItems);
    const amountTotal = Invoice.calculateTotal(amountSubtotal, amountDiscount, amountTax);

    return new Invoice({
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      patientId: input.patientId,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate ?? null,
      currency: input.currency ?? 'SYP',
      notes: input.notes ?? null,
      lineItems,
      status: new InvoiceStatus('draft'),
      amountSubtotal,
      amountDiscount,
      amountTax,
      amountTotal,
      amountPaid: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  canAddLineItems(): boolean {
    return this.status.canAddLineItems();
  }

  canIssue(): boolean {
    return this.status.canIssue();
  }

  issue(): void {
    if (!this.canIssue()) throw new InvoiceValidationException('Only draft invoices can be issued');
    if (this.lineItemsValue.length === 0) {
      throw new InvoiceValidationException('Invoice must have at least one line item before issuing');
    }
    if (this.amountTotal <= 0) {
      throw new InvoiceValidationException('Invoice total must be greater than zero before issuing');
    }
    this.status = new InvoiceStatus('issued');
    this.updatedAt = new Date();
  }

  addLineItem(input: {
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxPercent?: number;
  }): void {
    if (!this.canAddLineItems()) throw new InvoiceValidationException('Cannot add line items in current invoice status');
    const item = InvoiceLineItem.create(input);
    this.lineItemsValue.push(item);
    this.recalculateAmounts();
    this.updatedAt = new Date();
  }

  recordPayment(input: { amount: number; paymentMethod: string; paymentReference: string | null; paymentDate: Date }): void {
    if (input.amount <= 0) throw new InvoiceValidationException('Payment amount must be greater than zero');
    if (Number.isNaN(input.paymentDate.getTime())) throw new InvoiceValidationException('Payment date is invalid');
    if (this.status.isCancelled()) throw new InvoiceValidationException('Cannot record payment for cancelled invoice');
    if (this.status.status === 'draft') {
      throw new InvoiceValidationException('Invoice must be issued before recording payment');
    }
    this.amountPaid += input.amount;
    if (this.amountPaid >= this.amountTotal) {
      this.status = new InvoiceStatus('paid');
    } else if (this.amountPaid > 0) {
      this.status = new InvoiceStatus('partial_paid');
    }
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (!this.status.canCancelInvoice()) throw new InvoiceValidationException('Invoice cannot be cancelled in current status');
    if (this.amountPaid > 0) throw new InvoiceValidationException('Cannot cancel invoice with recorded payments');
    this.status = new InvoiceStatus('cancelled');
    this.updatedAt = new Date();
  }

  markOverdue(): void {
    if (this.status.canMarkOverdue()) {
      this.status = new InvoiceStatus('overdue');
      this.updatedAt = new Date();
    }
  }

  private recalculateAmounts(): void {
    const subtotal = Invoice.calculateSubtotal(this.lineItemsValue);
    const discount = Invoice.calculateDiscount(this.lineItemsValue);
    const tax = Invoice.calculateTax(this.lineItemsValue);
    const total = Invoice.calculateTotal(subtotal, discount, tax);
    (this as { amountSubtotal: number }).amountSubtotal = subtotal;
    (this as { amountDiscount: number }).amountDiscount = discount;
    (this as { amountTax: number }).amountTax = tax;
    (this as { amountTotal: number }).amountTotal = total;
  }

  private static calculateSubtotal(items: InvoiceLineItem[]): number {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  private static calculateDiscount(items: InvoiceLineItem[]): number {
    return items.reduce((sum, item) => sum + item.discountAmount, 0);
  }

  private static calculateTax(items: InvoiceLineItem[]): number {
    return items.reduce((sum, item) => sum + item.taxAmount, 0);
  }

  private static calculateTotal(subtotal: number, discount: number, tax: number): number {
    return subtotal - discount + tax;
  }

  toJSON() {
    return {
      invoiceId: this.invoiceId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      patientId: this.patientId,
      invoiceNumber: this.invoiceNumber,
      invoiceDate: this.invoiceDate.toISOString(),
      dueDate: this.dueDate?.toISOString() ?? null,
      currency: this.currency,
      notes: this.notes,
      lineItems: this.lineItemsValue.map((item) => item.toJSON()),
      status: this.status.status,
      amountSubtotal: this.amountSubtotal,
      amountDiscount: this.amountDiscount,
      amountTax: this.amountTax,
      amountTotal: this.amountTotal,
      amountPaid: this.amountPaid,
      amountDue: this.amountDue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
