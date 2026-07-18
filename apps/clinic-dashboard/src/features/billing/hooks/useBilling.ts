import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  addInvoiceLineItem,
  billInventoryConsumptions,
  cancelInvoice,
  createInvoice,
  exportInvoicesCsv,
  fetchBillingAnalytics,
  fetchBillingSummary,
  fetchInvoiceById,
  fetchInvoiceConsumptions,
  fetchInvoices,
  fetchUnbilledConsumptions,
  issueInvoice,
  recordInvoicePayment,
  fetchInvoicesPaginated,
  fetchNextInvoiceNumber,
  recordRefund,
  createCreditNote,
  writeOffInvoice,
  openCashSession,
  closeCashSession,
  fetchActiveCashSession,
  fetchCashSessions,
  fetchServicePrices,
  upsertServicePrice,
  createPaymentPlan,
  fetchPaymentPlans,
  recordSplitPayments,
  fetchReceipt,
  fetchInvoiceReceipts,
  applyInvoiceInsurance,
} from '../api/billing-api';
import type { CreateInvoiceInput, SplitPaymentLine } from '../types/billing.types';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useBillingSummary(enabled = true, branchId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'summary', branchId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBillingSummary(token, user.tenantId, branchId);
    },
    staleTime: 30_000,
  });
}

export function useBillingAnalytics(days = 30, enabled = true, branchId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'analytics', days, branchId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBillingAnalytics(token, user.tenantId, days, branchId);
    },
    staleTime: 60_000,
  });
}

export function useExportInvoices() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (params?: { branchId?: string; patientId?: string; status?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportInvoicesCsv(token, user.tenantId, params);
    },
  });
}

export function useCreateInvoice() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInvoiceInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInvoice(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useAddInvoiceLineItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      ...body
    }: {
      invoiceId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      taxPercent?: number;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return addInvoiceLineItem(token, user.tenantId, invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useInvoices(params?: { patientId?: string; status?: string; enabled?: boolean }) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'invoices', params?.patientId ?? 'all', params?.status ?? 'all', ...authKeys(user)],
    enabled: (params?.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInvoices(token, user.tenantId, {
        patientId: params?.patientId,
        status: params?.status,
      });
    },
    staleTime: 30_000,
  });
}

export function useInvoice(invoiceId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'invoice', invoiceId ?? 'none', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && invoiceId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !invoiceId) throw new Error('Not authenticated');
      return fetchInvoiceById(token, user.tenantId, invoiceId);
    },
    staleTime: 15_000,
  });
}

export function useInvoiceConsumptions(invoiceId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'invoice-consumptions', invoiceId ?? 'none', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && invoiceId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !invoiceId) throw new Error('Not authenticated');
      return fetchInvoiceConsumptions(token, user.tenantId, invoiceId);
    },
    staleTime: 15_000,
  });
}

export function useUnbilledConsumptions(patientId: string | null, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'unbilled-consumptions', patientId ?? 'none', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchUnbilledConsumptions(token, user.tenantId, patientId);
    },
    staleTime: 15_000,
  });
}

export function useBillConsumptions() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patientId: string; consumptionIds: string[]; invoiceId?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return billInventoryConsumptions(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRecordInvoicePayment() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentMethod,
      paymentReference,
      paymentDate,
    }: {
      invoiceId: string;
      amount: number;
      paymentMethod: string;
      paymentReference?: string;
      paymentDate?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return recordInvoicePayment(token, user.tenantId, invoiceId, {
        amount,
        paymentMethod,
        paymentReference,
        paymentDate,
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useCancelInvoice() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelInvoice(token, user.tenantId, invoiceId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useInvoicesPaginated(params?: {
  patientId?: string;
  status?: string;
  search?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [
      'billing',
      'invoices-paged',
      params?.patientId ?? 'all',
      params?.status ?? 'all',
      params?.search ?? '',
      params?.page ?? 1,
      params?.pageSize ?? 25,
      ...authKeys(user),
    ],
    enabled: (params?.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInvoicesPaginated(token, user.tenantId, params);
    },
    staleTime: 20_000,
  });
}

export function useNextInvoiceNumber(enabled = false) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'next-number', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNextInvoiceNumber(token, user.tenantId);
    },
    staleTime: 0,
  });
}

export function useActiveCashSession(enabled = true, branchId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'cash-session', branchId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchActiveCashSession(token, user.tenantId, branchId);
    },
    staleTime: 15_000,
  });
}

export function useCashSessions(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'cash-sessions', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchCashSessions(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useServicePrices(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'service-prices', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchServicePrices(token, user.tenantId, true);
    },
    staleTime: 60_000,
  });
}

export function usePaymentPlans(invoiceId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'payment-plans', invoiceId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchPaymentPlans(token, user.tenantId, invoiceId);
    },
    staleTime: 30_000,
  });
}

export function useRecordRefund() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string; amount: number; reason: string; refundMethod: string; paymentId?: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return recordRefund(token, user.tenantId, body.invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useCreateCreditNote() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string; amount: number; reason: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createCreditNote(token, user.tenantId, body.invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useWriteOffInvoice() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string; amount: number; reason: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return writeOffInvoice(token, user.tenantId, body.invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useOpenCashSession() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { openingBalance: number; branchId?: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return openCashSession(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useCloseCashSession() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { sessionId: string; actualCash: number; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return closeCashSession(token, user.tenantId, body.sessionId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useUpsertServicePrice() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { serviceCode: string; nameEn: string; nameAr?: string; unitPrice: number; taxPercent?: number; isActive?: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return upsertServicePrice(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useCreatePaymentPlan() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string; patientId: string; installmentCount: number; startDate: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createPaymentPlan(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useRecordSplitPayments() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { invoiceId: string; payments: SplitPaymentLine[]; paymentDate?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return recordSplitPayments(token, user.tenantId, body.invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useIssueInvoice() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return issueInvoice(token, user.tenantId, invoiceId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useReceipt(receiptNumber: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'receipt', receiptNumber, ...authKeys(user)],
    enabled: enabled && Boolean(receiptNumber && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !receiptNumber) throw new Error('Not authenticated');
      return fetchReceipt(token, user.tenantId, receiptNumber);
    },
    staleTime: 60_000,
  });
}

export function useInvoiceReceipts(invoiceId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['billing', 'invoice-receipts', invoiceId, ...authKeys(user)],
    enabled: enabled && Boolean(invoiceId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !invoiceId) throw new Error('Not authenticated');
      return fetchInvoiceReceipts(token, user.tenantId, invoiceId);
    },
    staleTime: 30_000,
  });
}

export function useApplyInvoiceInsurance() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      invoiceId: string;
      insuranceProvider: string;
      insurancePolicyNumber?: string;
      insuranceAmount: number;
      patientResponsibility: number;
      insuranceClaimStatus?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return applyInvoiceInsurance(token, user.tenantId, body.invoiceId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}
