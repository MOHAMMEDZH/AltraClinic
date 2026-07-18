export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  patientId: string;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  invoiceDate: string;
}

export interface InvoiceSummary {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  invoices: InvoiceListItem[];
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
}
