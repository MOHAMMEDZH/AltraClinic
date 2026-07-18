import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import type { InvoiceListItem, InvoiceSummary } from '../types/billing.types';
import { createInvoiceFromPlan, fetchPatientInvoices } from '../api/billing-api';
import type { PlanLineItem } from '../config/billing-utils';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useCanCreateBillingInvoice(): boolean {
  const { user } = useAuth();
  return hasPermission(user?.roles ?? [], 'api.billing', 'create');
}

export function usePatientInvoices(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'invoices', patientId, ...authKeys(user)],
    enabled: enabled && Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientInvoices(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function useCreatePlanInvoice(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      planId: string;
      planTitle: string;
      lineItems: PlanLineItem[];
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      if (!hasPermission(user.roles ?? [], 'api.billing', 'create')) {
        throw new Error('Billing permission required');
      }
      return createInvoiceFromPlan(token, user.tenantId, patientId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing', 'invoices', patientId] });
    },
  });
}

export function useBillingSummary(patientId: string | undefined, enabled = true) {
  const query = usePatientInvoices(patientId, enabled);
  const summary: InvoiceSummary | null = query.data
    ? {
        totalInvoiced: query.data.reduce((s, i) => s + i.totalAmount, 0),
        totalPaid: query.data.reduce((s, i) => s + i.amountPaid, 0),
        outstanding: query.data.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0),
        invoices: query.data,
      }
    : null;
  return { ...query, summary };
}

export type { InvoiceListItem };
