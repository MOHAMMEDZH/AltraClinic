import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  approveCommission,
  calculateCommissionFromInvoices,
  createCommissionRule,
  fetchCommission,
  fetchCommissionRules,
  fetchCommissions,
  payCommission,
} from '../api/commission-api';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useCommissions(enabled = true, params?: { providerId?: string; status?: string }) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['commission', 'list', ...authKeys(user), params],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchCommissions(token, user.tenantId, params);
    },
    staleTime: 20_000,
  });
}

export function useCommission(commissionId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['commission', commissionId, ...authKeys(user)],
    enabled: enabled && Boolean(commissionId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !commissionId) throw new Error('Not authenticated');
      return fetchCommission(token, user.tenantId, commissionId);
    },
  });
}

export function useCommissionRules(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['commission', 'rules', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchCommissionRules(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useCalculateCommissionFromInvoices() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { providerId: string; periodStart: string; periodEnd: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return calculateCommissionFromInvoices(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['commission'] }),
  });
}

export function useApproveCommission() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commissionId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveCommission(token, user.tenantId, commissionId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['commission'] }),
  });
}

export function usePayCommission() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { commissionId: string; paymentMethod: string; paymentReference?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return payCommission(token, user.tenantId, body.commissionId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['commission'] }),
  });
}

export function useCreateCommissionRule() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      providerId?: string;
      serviceType?: string;
      commissionRateType: 'percentage' | 'fixed_amount';
      commissionRateValue: number;
      effectiveDate: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createCommissionRule(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['commission'] }),
  });
}
