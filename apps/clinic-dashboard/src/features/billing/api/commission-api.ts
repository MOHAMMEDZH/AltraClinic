import { apiRequest } from '@/lib/api-client';

export interface CommissionLineItem {
  itemId: string;
  serviceDescription: string;
  serviceType: string | null;
  amount: number;
  commissionAmount: number;
}

export interface CommissionRecord {
  commissionId: string;
  providerId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  status: { status: string; reason?: string | null };
  totalRevenue: number;
  commissionAmount: number;
  currency: string;
  lineItems?: CommissionLineItem[];
}

export interface CommissionRule {
  ruleId: string;
  providerId: string | null;
  serviceType: string | null;
  commissionRate: { type: string; value: number };
  effectiveDate: string;
  expiryDate: string | null;
}

function mapCommission(raw: unknown): CommissionRecord {
  const r = raw as Record<string, unknown>;
  const status = r.status as Record<string, unknown> | string | undefined;
  return {
    commissionId: String(r.commissionId ?? r.id ?? ''),
    providerId: String(r.providerId ?? ''),
    branchId: r.branchId != null ? String(r.branchId) : null,
    periodStart: String(r.periodStart ?? ''),
    periodEnd: String(r.periodEnd ?? ''),
    status: typeof status === 'object' && status
      ? { status: String(status.status ?? 'draft'), reason: status.reason != null ? String(status.reason) : null }
      : { status: String(status ?? 'draft') },
    totalRevenue: Number(r.totalRevenue ?? 0),
    commissionAmount: Number(r.commissionAmount ?? 0),
    currency: String(r.currency ?? 'SYP'),
    lineItems: Array.isArray(r.lineItems)
      ? r.lineItems.map((li) => {
          const item = li as Record<string, unknown>;
          return {
            itemId: String(item.itemId ?? item.id ?? ''),
            serviceDescription: String(item.serviceDescription ?? ''),
            serviceType: item.serviceType != null ? String(item.serviceType) : null,
            amount: Number(item.amount ?? 0),
            commissionAmount: Number(item.commissionAmount ?? 0),
          };
        })
      : undefined,
  };
}

function mapRule(raw: unknown): CommissionRule {
  const r = raw as Record<string, unknown>;
  const rate = r.commissionRate as Record<string, unknown> | undefined;
  return {
    ruleId: String(r.ruleId ?? r.id ?? ''),
    providerId: r.providerId != null ? String(r.providerId) : null,
    serviceType: r.serviceType != null ? String(r.serviceType) : null,
    commissionRate: {
      type: String(rate?.type ?? 'percentage'),
      value: Number(rate?.value ?? 0),
    },
    effectiveDate: String(r.effectiveDate ?? ''),
    expiryDate: r.expiryDate != null ? String(r.expiryDate) : null,
  };
}

export async function fetchCommissions(token: string, tenantId: string, params?: { providerId?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.providerId) qs.set('providerId', params.providerId);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const rows = await apiRequest<unknown[]>(`/commissions${suffix}`, { token, tenantId });
  return (rows ?? []).map(mapCommission);
}

export async function fetchCommission(token: string, tenantId: string, commissionId: string) {
  const row = await apiRequest<unknown>(`/commissions/${encodeURIComponent(commissionId)}`, { token, tenantId });
  return mapCommission(row);
}

export async function fetchCommissionRules(token: string, tenantId: string) {
  const rows = await apiRequest<unknown[]>(`/commissions/rules/list`, { token, tenantId });
  return (rows ?? []).map(mapRule);
}

export async function calculateCommissionFromInvoices(
  token: string,
  tenantId: string,
  body: { providerId: string; periodStart: string; periodEnd: string },
) {
  return apiRequest<{ commissionId: string; lineItemCount: number }>(`/commissions/calculate-from-invoices`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function approveCommission(token: string, tenantId: string, commissionId: string) {
  return apiRequest(`/commissions/${encodeURIComponent(commissionId)}/approve`, { method: 'POST', token, tenantId });
}

export async function payCommission(
  token: string,
  tenantId: string,
  commissionId: string,
  body: { paymentMethod: string; paymentReference?: string },
) {
  return apiRequest(`/commissions/${encodeURIComponent(commissionId)}/pay`, { method: 'POST', token, tenantId, body });
}

export async function createCommissionRule(
  token: string,
  tenantId: string,
  body: {
    providerId?: string;
    serviceType?: string;
    commissionRateType: 'percentage' | 'fixed_amount';
    commissionRateValue: number;
    effectiveDate: string;
  },
) {
  return apiRequest(`/commissions/rules`, { method: 'POST', token, tenantId, body });
}
