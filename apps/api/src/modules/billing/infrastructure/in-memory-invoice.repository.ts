import { Injectable } from '@nestjs/common';
import { Invoice } from '../domain/entities/invoice.entity';
import { InvoiceRepository } from '../domain/repositories/invoice.repository.interface';

@Injectable()
export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly store = new Map<string, Map<string, Invoice>>();

  private bucket(tenantId: string): Map<string, Invoice> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(invoice: Invoice, _consumptionLinks?: Array<{ consumptionId: string; lineItemId: string }>): Promise<void> {
    const bucket = this.bucket(invoice.tenantId);
    bucket.set(invoice.invoiceId, invoice);
  }

  async findById(invoiceId: string, tenantId: string): Promise<Invoice | null> {
    const bucket = this.bucket(tenantId);
    return bucket.get(invoiceId) ?? null;
  }

  async list(filters: { tenantId: string; branchId?: string | null; patientId?: string | null; status?: string | null }): Promise<Invoice[]> {
    const bucket = this.bucket(filters.tenantId);
    let invoices = Array.from(bucket.values());
    if (filters.branchId) {
      invoices = invoices.filter((invoice) => invoice.branchId === filters.branchId);
    }
    if (filters.patientId) {
      invoices = invoices.filter((invoice) => invoice.patientId === filters.patientId);
    }
    if (filters.status) {
      invoices = invoices.filter((invoice) => invoice.status.status === filters.status);
    }
    return invoices;
  }
}
