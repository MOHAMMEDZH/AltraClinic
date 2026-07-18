import { ApiError, apiRequest } from '@/lib/api-client';
import type { CreateInvoiceResult, InvoiceListItem } from '../types/billing.types';
import type { PlanLineItem } from '../config/billing-utils';

function invoiceStatus(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'status' in raw) {
    return String((raw as { status: unknown }).status);
  }
  return 'draft';
}

export function mapInvoiceResponse(raw: unknown): InvoiceListItem {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.invoiceId ?? r.id ?? ''),
    invoiceNumber: String(r.invoiceNumber ?? ''),
    patientId: String(r.patientId ?? ''),
    status: invoiceStatus(r.status),
    totalAmount: Number(r.amountTotal ?? r.totalAmount ?? 0),
    amountPaid: Number(r.amountPaid ?? 0),
    currency: String(r.currency ?? 'USD'),
    invoiceDate:
      r.invoiceDate instanceof Date
        ? r.invoiceDate.toISOString()
        : String(r.invoiceDate ?? new Date().toISOString()),
  };
}

export async function fetchPatientInvoices(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<InvoiceListItem[]> {
  const rows = await apiRequest<unknown[]>(
    `/billing/invoices?patientId=${encodeURIComponent(patientId)}`,
    { token, tenantId },
  );
  return (rows ?? []).map(mapInvoiceResponse).filter((row) => row.id);
}

export async function fetchInvoiceById(
  token: string,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceListItem> {
  const row = await apiRequest<unknown>(`/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    token,
    tenantId,
  });
  return mapInvoiceResponse(row);
}

function uniqueInvoiceNumber(planId: string): string {
  const suffix = planId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `INV-B-${suffix}-${time}`;
}

export async function createInvoiceFromPlan(
  token: string,
  tenantId: string,
  patientId: string,
  payload: {
    planId: string;
    planTitle: string;
    lineItems: PlanLineItem[];
  },
): Promise<CreateInvoiceResult> {
  if (!payload.lineItems.length) {
    throw new ApiError('At least one line item is required', 400);
  }

  const invoiceNumber = uniqueInvoiceNumber(payload.planId);
  const created = await apiRequest<{ invoiceId: string }>('/billing/invoices', {
    method: 'POST',
    token,
    tenantId,
    body: {
      patientId,
      invoiceNumber,
      invoiceDate: new Date().toISOString(),
      currency: 'USD',
      requireActiveSubscription: false,
      notes: `Beauty treatment plan: ${payload.planTitle} [plan:${payload.planId}]`,
      lineItems: payload.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: 0,
        taxPercent: 0,
      })),
    },
  });

  const invoice = await fetchInvoiceById(token, tenantId, created.invoiceId);
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount,
  };
}
