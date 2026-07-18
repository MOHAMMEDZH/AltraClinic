export class AddInvoiceLineItemCommand {
  constructor(
    public readonly invoiceId: string,
    public readonly description: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly discountPercent: number,
    public readonly taxPercent: number,
  ) {}
}
