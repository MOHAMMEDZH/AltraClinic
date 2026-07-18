export class RecordInvoicePaymentCommand {
  constructor(
    public readonly invoiceId: string,
    public readonly amount: number,
    public readonly paymentMethod: string,
    public readonly paymentReference: string | null,
    public readonly paymentDate: string | null,
  ) {}
}
