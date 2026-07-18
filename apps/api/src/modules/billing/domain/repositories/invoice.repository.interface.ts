import { Invoice } from '../entities/invoice.entity';

export interface InvoiceRepository {
  save(
    invoice: Invoice,
    consumptionLinks?: Array<{ consumptionId: string; lineItemId: string }>,
  ): Promise<void>;
  findById(invoiceId: string, tenantId: string): Promise<Invoice | null>;
  list(filters: { tenantId: string; branchId?: string | null; patientId?: string | null; status?: string | null }): Promise<Invoice[]>;
}
