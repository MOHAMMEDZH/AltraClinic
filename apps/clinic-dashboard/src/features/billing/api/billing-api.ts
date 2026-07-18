import { ApiError, apiRequest, API_BASE } from '@/lib/api-client';
import type {
  BillConsumptionsResult,
  BillingAnalytics,
  BillingSummary,
  CreateInvoiceInput,
  CreateInvoiceResult,
  CreditNote,
  CashSession,
  InventoryConsumption,
  Invoice,
  InvoiceRefund,
  PaginatedInvoices,
  PaymentPlan,
  PaymentReceiptDetail,
  InvoiceReceiptSummary,
  RecordPaymentResult,
  ServicePrice,
  SplitPaymentLine,
} from '../types/billing.types';

function invoiceStatus(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'status' in raw) {
    return String((raw as { status: unknown }).status);
  }
  return 'draft';
}

export function mapInvoice(raw: unknown): Invoice {
  const r = raw as Record<string, unknown>;
  const lineItems = (r.lineItems as unknown[] | undefined) ?? [];
  const payments = (r.payments as unknown[] | undefined) ?? [];
  const amountTotal = Number(r.amountTotal ?? 0);
  const amountPaid = Number(r.amountPaid ?? 0);
  return {
    invoiceId: String(r.invoiceId ?? r.id ?? ''),
    invoiceNumber: String(r.invoiceNumber ?? ''),
    patientId: String(r.patientId ?? ''),
    status: invoiceStatus(r.status),
    currency: String(r.currency ?? 'SYP'),
    amountSubtotal: Number(r.amountSubtotal ?? amountTotal),
    amountTotal,
    amountPaid,
    amountDue: Number(r.amountDue ?? Math.max(0, amountTotal - amountPaid)),
    invoiceDate:
      r.invoiceDate instanceof Date
        ? r.invoiceDate.toISOString()
        : String(r.invoiceDate ?? new Date().toISOString()),
    notes: r.notes != null ? String(r.notes) : null,
    insuranceProvider: r.insuranceProvider != null ? String(r.insuranceProvider) : null,
    insurancePolicyNumber: r.insurancePolicyNumber != null ? String(r.insurancePolicyNumber) : null,
    insuranceAmount: r.insuranceAmount != null ? Number(r.insuranceAmount) : 0,
    patientResponsibility: r.patientResponsibility != null ? Number(r.patientResponsibility) : 0,
    insuranceClaimStatus: r.insuranceClaimStatus != null ? String(r.insuranceClaimStatus) : null,
    lineItems: lineItems.map((row) => {
      const li = row as Record<string, unknown>;
      const qty = Number(li.quantity ?? 0);
      const unitPrice = Number(li.unitPrice ?? 0);
      return {
        itemId: String(li.itemId ?? li.id ?? ''),
        description: String(li.description ?? ''),
        quantity: qty,
        unitPrice,
        lineTotal: Number(li.lineTotal ?? li.subtotal ?? qty * unitPrice),
      };
    }),
    payments: payments.map((row) => {
      const p = row as Record<string, unknown>;
      return {
        paymentId: String(p.paymentId ?? p.id ?? ''),
        amount: Number(p.amount ?? 0),
        paymentMethod: String(p.paymentMethod ?? ''),
        paymentReference: p.paymentReference != null ? String(p.paymentReference) : null,
        paymentDate: String(p.paymentDate ?? ''),
        recordedBy: String(p.recordedBy ?? ''),
        createdAt: String(p.createdAt ?? ''),
      };
    }),
  };
}

function mapConsumption(raw: unknown): InventoryConsumption {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    itemId: String(r.itemId ?? ''),
    sku: String(r.sku ?? ''),
    itemName: String(r.itemName ?? ''),
    quantityUsed: Number(r.quantityUsed ?? 0),
    unit: String(r.unit ?? ''),
    unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
    patientId: r.patientId != null ? String(r.patientId) : null,
    procedureCode: r.procedureCode != null ? String(r.procedureCode) : null,
    invoiceId: r.invoiceId != null ? String(r.invoiceId) : null,
    consumedAt: String(r.consumedAt ?? new Date().toISOString()),
  };
}

export async function fetchBillingSummary(token: string, tenantId: string, branchId?: string): Promise<BillingSummary> {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return apiRequest<BillingSummary>(`/billing/summary${qs}`, { token, tenantId });
}

export async function fetchBillingAnalytics(
  token: string,
  tenantId: string,
  days = 30,
  branchId?: string,
): Promise<BillingAnalytics> {
  const qs = new URLSearchParams({ days: String(days) });
  if (branchId) qs.set('branchId', branchId);
  return apiRequest<BillingAnalytics>(`/billing/analytics?${qs.toString()}`, { token, tenantId });
}

export async function exportInvoicesCsv(
  token: string,
  tenantId: string,
  params?: { branchId?: string; patientId?: string; status?: string },
): Promise<{ csv: string; filename: string }> {
  const qs = new URLSearchParams();
  if (params?.branchId) qs.set('branchId', params.branchId);
  if (params?.patientId) qs.set('patientId', params.patientId);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const headers = new Headers({ Accept: 'text/csv' });
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(`${API_BASE}/billing/invoices/export${suffix}`, { headers });
  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }
  const csv = await response.text();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  const filename = filenameMatch?.[1] ?? `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return { csv, filename };
}

export async function createInvoice(
  token: string,
  tenantId: string,
  body: CreateInvoiceInput,
): Promise<CreateInvoiceResult> {
  const data = await apiRequest<CreateInvoiceResult>('/billing/invoices', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
  return {
    invoiceId: String(data.invoiceId),
    invoiceNumber: String(data.invoiceNumber),
    status: String(data.status ?? 'draft'),
    amountTotal: Number(data.amountTotal ?? 0),
  };
}

export async function addInvoiceLineItem(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { description: string; quantity: number; unitPrice: number; discountPercent?: number; taxPercent?: number },
): Promise<{ itemId: string; lineTotal: number }> {
  return apiRequest<{ itemId: string; lineTotal: number }>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}/line-items`,
    { method: 'POST', token, tenantId, body },
  );
}

export async function fetchInvoicesPaginated(
  token: string,
  tenantId: string,
  params?: {
    patientId?: string;
    status?: string;
    search?: string;
    branchId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<PaginatedInvoices> {
  const qs = new URLSearchParams();
  if (params?.patientId) qs.set('patientId', params.patientId);
  if (params?.status) qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  if (params?.branchId) qs.set('branchId', params.branchId);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const data = await apiRequest<PaginatedInvoices>(`/billing/invoices?${qs.toString()}`, { token, tenantId });
  return {
    ...data,
    items: (data.items ?? []).map(mapInvoice).filter((row) => row.invoiceId),
  };
}

export async function fetchNextInvoiceNumber(token: string, tenantId: string, prefix = 'INV'): Promise<string> {
  const data = await apiRequest<{ invoiceNumber: string }>(
    `/billing/invoices/next-number?prefix=${encodeURIComponent(prefix)}`,
    { token, tenantId },
  );
  return data.invoiceNumber;
}

export async function recordRefund(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { amount: number; reason: string; refundMethod: string; paymentId?: string; refundReference?: string; notes?: string },
) {
  return apiRequest<{ invoiceId: string; refundedAmount: number }>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}/refunds`,
    { method: 'POST', token, tenantId, body },
  );
}

export async function createCreditNote(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { amount: number; reason: string; notes?: string; issue?: boolean },
) {
  return apiRequest<CreditNote>(`/billing/invoices/${encodeURIComponent(invoiceId)}/credit-notes`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function writeOffInvoice(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { amount: number; reason: string; notes?: string },
) {
  return apiRequest<{ invoiceId: string; writeOffAmount: number }>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}/write-off`,
    { method: 'POST', token, tenantId, body },
  );
}

export async function openCashSession(
  token: string,
  tenantId: string,
  body: { openingBalance: number; branchId?: string; notes?: string },
) {
  return apiRequest<CashSession>('/billing/cash-sessions/open', { method: 'POST', token, tenantId, body });
}

export async function closeCashSession(
  token: string,
  tenantId: string,
  sessionId: string,
  body: { actualCash: number; notes?: string },
) {
  return apiRequest<CashSession>(`/billing/cash-sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function fetchActiveCashSession(token: string, tenantId: string, branchId?: string) {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return apiRequest<CashSession | null>(`/billing/cash-sessions/active${qs}`, { token, tenantId });
}

export async function fetchCashSessions(token: string, tenantId: string, limit = 20) {
  return apiRequest<CashSession[]>(`/billing/cash-sessions?limit=${limit}`, { token, tenantId });
}

export async function fetchServicePrices(token: string, tenantId: string, all = false) {
  return apiRequest<ServicePrice[]>(`/billing/service-prices${all ? '?all=true' : ''}`, { token, tenantId });
}

export async function upsertServicePrice(
  token: string,
  tenantId: string,
  body: { serviceCode: string; nameEn: string; nameAr?: string; unitPrice: number; taxPercent?: number; isActive?: boolean },
) {
  return apiRequest<ServicePrice>('/billing/service-prices', { method: 'POST', token, tenantId, body });
}

export async function createPaymentPlan(
  token: string,
  tenantId: string,
  body: { invoiceId: string; patientId: string; installmentCount: number; startDate: string; notes?: string },
) {
  return apiRequest<{ planId: string; installmentCount: number; totalAmount: number }>('/billing/payment-plans', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function fetchPaymentPlans(token: string, tenantId: string, invoiceId?: string) {
  const qs = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : '';
  return apiRequest<PaymentPlan[]>(`/billing/payment-plans${qs}`, { token, tenantId });
}

export async function recordSplitPayments(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { payments: SplitPaymentLine[]; paymentDate?: string },
) {
  return apiRequest<{ invoiceId: string; receiptNumber: string; totalPaid: number; amountDue: number; status: string }>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}/split-payments`,
    { method: 'POST', token, tenantId, body },
  );
}

export async function fetchRefunds(token: string, tenantId: string, invoiceId?: string) {
  const qs = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : '';
  return apiRequest<InvoiceRefund[]>(`/billing/refunds${qs}`, { token, tenantId });
}

export async function fetchCreditNotes(token: string, tenantId: string, invoiceId?: string) {
  const qs = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : '';
  return apiRequest<CreditNote[]>(`/billing/credit-notes${qs}`, { token, tenantId });
}

export async function fetchInvoices(
  token: string,
  tenantId: string,
  params?: { patientId?: string; status?: string },
): Promise<Invoice[]> {
  const qs = new URLSearchParams();
  if (params?.patientId) qs.set('patientId', params.patientId);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const rows = await apiRequest<unknown[]>(`/billing/invoices${suffix}`, { token, tenantId });
  return (rows ?? []).map(mapInvoice).filter((row) => row.invoiceId);
}

export async function fetchInvoiceById(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<Invoice> {
  const row = await apiRequest<unknown>(`/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    token,
    tenantId,
  });
  return mapInvoice(row);
}

export async function fetchUnbilledConsumptions(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<InventoryConsumption[]> {
  const qs = new URLSearchParams({
    patientId,
    unbilled: 'true',
    limit: '100',
  });
  const data = await apiRequest<{ consumptions?: unknown[] }>(`/inventory/consumptions?${qs.toString()}`, {
    token,
    tenantId,
  });
  return (data.consumptions ?? []).map(mapConsumption);
}

export async function fetchInvoiceConsumptions(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<InventoryConsumption[]> {
  const qs = new URLSearchParams({ invoiceId, limit: '100' });
  const data = await apiRequest<{ consumptions?: unknown[] }>(`/inventory/consumptions?${qs.toString()}`, {
    token,
    tenantId,
  });
  return (data.consumptions ?? []).map(mapConsumption);
}

export async function billInventoryConsumptions(
  token: string,
  tenantId: string,
  body: { patientId: string; consumptionIds: string[]; invoiceId?: string },
): Promise<BillConsumptionsResult> {
  const data = await apiRequest<BillConsumptionsResult>('/billing/invoices/bill-consumptions', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
  return {
    invoiceId: String(data.invoiceId),
    invoiceNumber: String(data.invoiceNumber),
    amountTotal: Number(data.amountTotal ?? 0),
    linkedConsumptionCount: Number(data.linkedConsumptionCount ?? 0),
    created: Boolean(data.created),
  };
}

export async function recordInvoicePayment(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: { amount: number; paymentMethod: string; paymentReference?: string; paymentDate?: string },
): Promise<RecordPaymentResult> {
  return apiRequest<RecordPaymentResult>(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function cancelInvoice(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<{ invoiceId: string }> {
  return apiRequest<{ invoiceId: string }>(`/billing/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function issueInvoice(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<{ invoiceId: string; status: string; amountTotal: number }> {
  return apiRequest<{ invoiceId: string; status: string; amountTotal: number }>(
    `/billing/invoices/${encodeURIComponent(invoiceId)}/issue`,
    {
      method: 'POST',
      token,
      tenantId,
    },
  );
}

export async function fetchReceipt(
  token: string,
  tenantId: string,
  receiptNumber: string,
): Promise<PaymentReceiptDetail> {
  const data = await apiRequest<unknown>(`/billing/receipts/${encodeURIComponent(receiptNumber)}`, { token, tenantId });
  const r = data as Record<string, unknown>;
  return {
    receiptNumber: String(r.receiptNumber ?? ''),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? 'SYP'),
    issuedAt: String(r.issuedAt ?? new Date().toISOString()),
    invoice: mapInvoice(r.invoice),
  };
}

export async function fetchInvoiceReceipts(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceReceiptSummary[]> {
  const rows = await apiRequest<unknown[]>(`/billing/invoices/${encodeURIComponent(invoiceId)}/receipts`, { token, tenantId });
  return (rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      receiptNumber: String(r.receiptNumber ?? ''),
      amount: Number(r.amount ?? 0),
      currency: String(r.currency ?? 'SYP'),
      issuedAt: String(r.issuedAt ?? ''),
      paymentId: r.paymentId != null ? String(r.paymentId) : null,
    };
  });
}

export async function applyInvoiceInsurance(
  token: string,
  tenantId: string,
  invoiceId: string,
  body: {
    insuranceProvider: string;
    insurancePolicyNumber?: string;
    insuranceAmount: number;
    patientResponsibility: number;
    insuranceClaimStatus?: string;
  },
): Promise<{ invoiceId: string; insuranceClaimStatus: string }> {
  return apiRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/insurance`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export function mapBillingApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'permissionDenied';
    if (err.status === 404) return 'notFound';
    if (err.status === 400) return 'invalidRequest';
  }
  return 'generic';
}
