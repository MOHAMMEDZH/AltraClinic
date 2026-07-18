import { randomUUID } from 'crypto';
import { InvoiceValidationException } from '../exceptions/invoice-validation.exception';

export interface InvoiceLineItemProps {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  subtotal: number;
}

export class InvoiceLineItem {
  public readonly itemId: string;
  public readonly description: string;
  public readonly quantity: number;
  public readonly unitPrice: number;
  public readonly discountPercent: number;
  public readonly discountAmount: number;
  public readonly taxPercent: number;
  public readonly taxAmount: number;
  public readonly subtotal: number;

  private constructor(props: InvoiceLineItemProps) {
    this.itemId = props.itemId;
    this.description = props.description;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discountPercent = props.discountPercent;
    this.discountAmount = props.discountAmount;
    this.taxPercent = props.taxPercent;
    this.taxAmount = props.taxAmount;
    this.subtotal = props.subtotal;
  }

  /** Reconstitutes an InvoiceLineItem from a persistence record. */
  static restore(props: InvoiceLineItemProps): InvoiceLineItem {
    return new InvoiceLineItem(props);
  }

  static create(input: {
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxPercent?: number;
  }): InvoiceLineItem {
    if (!input.description?.trim()) throw new InvoiceValidationException('Invoice line description is required');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0 || !Number.isInteger(input.quantity)) {
      throw new InvoiceValidationException('Invoice line quantity must be a positive integer');
    }
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
      throw new InvoiceValidationException('Invoice line unitPrice must be a non-negative finite number');
    }
    const discountPercent = Math.max(0, input.discountPercent ?? 0);
    const taxPercent = Math.max(0, input.taxPercent ?? 0);
    if (discountPercent > 100) throw new InvoiceValidationException('Invoice line discountPercent cannot exceed 100');
    if (taxPercent > 100) throw new InvoiceValidationException('Invoice line taxPercent cannot exceed 100');
    const subtotal = input.quantity * input.unitPrice;
    const discountAmount = (subtotal * discountPercent) / 100;
    const taxAmount = ((subtotal - discountAmount) * taxPercent) / 100;
    return new InvoiceLineItem({
      itemId: randomUUID(),
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      subtotal,
    });
  }

  toJSON() {
    return {
      itemId: this.itemId,
      description: this.description,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      discountPercent: this.discountPercent,
      discountAmount: this.discountAmount,
      taxPercent: this.taxPercent,
      taxAmount: this.taxAmount,
      subtotal: this.subtotal,
    };
  }
}
