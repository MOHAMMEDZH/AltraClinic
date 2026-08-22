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
      /** Server-derived only (appointment billing / bind). Not accepted from public DTOs. */
      servicePerformanceId?: string | null;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      snapshotRevisionId?: string | null;
      courseSessionId?: string | null;
    }>,
    public readonly requireActiveSubscription?: boolean,
  ) {}
}
