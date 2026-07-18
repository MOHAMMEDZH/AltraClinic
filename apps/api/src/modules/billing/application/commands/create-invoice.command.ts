export class CreateInvoiceCommand {
  constructor(
    public readonly patientId: string,
    public readonly invoiceNumber: string,
    public readonly invoiceDate: string,
    public readonly dueDate: string | null,
    public readonly branchId: string | null,
    public readonly currency: string,
    public readonly notes: string | null,
    public readonly lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      taxPercent?: number;
    }>,
    public readonly requireActiveSubscription?: boolean,
  ) {}
}
