export interface InvoicePayment {
  paymentId: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string | null;
  paymentDate: string;
  recordedBy: string;
  createdAt: string;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  status: string;
  currency: string;
  amountSubtotal: number;
  amountTotal: number;
  amountPaid: number;
  amountDue: number;
  invoiceDate: string;
  notes: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceAmount?: number;
  patientResponsibility?: number;
  insuranceClaimStatus?: string | null;
  lineItems: InvoiceLineItem[];
  payments?: InvoicePayment[];
}

export interface InvoiceLineItem {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InventoryConsumption {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantityUsed: number;
  unit: string;
  unitPrice: number | null;
  patientId: string | null;
  procedureCode: string | null;
  invoiceId: string | null;
  consumedAt: string;
}

export interface BillConsumptionsResult {
  invoiceId: string;
  invoiceNumber: string;
  amountTotal: number;
  linkedConsumptionCount: number;
  created: boolean;
}

export interface RecordPaymentResult {
  invoiceId: string;
  status: string;
  amountPaid: number;
  amountDue: number;
  receiptNumber?: string;
}

export interface PaymentReceiptDetail {
  receiptNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
  invoice: Invoice;
}

export interface InvoiceReceiptSummary {
  receiptNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
  paymentId: string | null;
}

export interface BillingAging {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
}

export interface BillingRecentPayment {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  currency: string;
}

export interface BillingSummary {
  draftCount: number;
  issuedCount: number;
  partialPaidCount: number;
  paidCount: number;
  overdueCount: number;
  cancelledCount: number;
  outstandingCount: number;
  outstandingAmount: number;
  revenueToday: number;
  revenueMonth: number;
  collectionsToday: number;
  paymentsTodayCount: number;
  aging: BillingAging;
  recentPayments: BillingRecentPayment[];
}

export interface BillingAnalyticsDay {
  date: string;
  collections: number;
  paymentCount: number;
  invoiced: number;
  invoiceCount: number;
}

export interface BillingAnalyticsStatus {
  status: string;
  count: number;
  amountTotal: number;
  amountPaid: number;
}

export interface BillingAnalytics {
  generatedAt: string;
  periodDays: number;
  byDay: BillingAnalyticsDay[];
  byStatus: BillingAnalyticsStatus[];
  byPaymentMethod: Array<{ method: string; amount: number }>;
  totals: {
    collections: number;
    paymentCount: number;
    invoiced: number;
    invoiceCount: number;
  };
}

export interface CreateInvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
}

export interface CreateInvoiceInput {
  patientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  branchId?: string | null;
  currency?: string;
  notes?: string | null;
  lineItems?: CreateInvoiceLineInput[];
  requireActiveSubscription?: boolean;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  amountTotal: number;
}

export interface PaginatedInvoices {
  items: Invoice[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CashSession {
  sessionId: string;
  branchId: string | null;
  openedBy: string;
  closedBy: string | null;
  status: string;
  openingBalance: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
}

export interface ServicePrice {
  id: string;
  serviceCode: string;
  nameEn: string;
  nameAr: string | null;
  unitPrice: number;
  currency: string;
  taxPercent: number;
  isActive: boolean;
}

export interface PaymentPlan {
  planId: string;
  invoiceId: string;
  patientId: string;
  status: string;
  totalAmount: number;
  installmentCount: number;
  currency: string;
  startDate: string;
  installments: Array<{
    installmentId: string;
    sequence: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    paidAt: string | null;
  }>;
}

export interface InvoiceRefund {
  refundId: string;
  invoiceId: string;
  paymentId: string | null;
  amount: number;
  reason: string;
  refundMethod: string;
  refundDate: string;
  approvedBy: string;
}

export interface CreditNote {
  creditNoteId: string;
  creditNoteNumber: string;
  invoiceId: string;
  status: string;
  amount: number;
  reason: string;
  issuedAt: string | null;
}

export interface SplitPaymentLine {
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
}
