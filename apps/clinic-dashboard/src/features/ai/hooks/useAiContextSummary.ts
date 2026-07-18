import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchAiContextSummary } from '../api/ai-api';
import { useAiRouteContext } from './useAiContext';

const ROOT = ['ai', 'context', 'summary'] as const;

export function useAiContextSummary(enabled = true) {
  const { locale } = useI18n();
  const context = useAiRouteContext();
  const { getValidAccessToken, user } = useAuth();

  const queryKey = useMemo(
    () => [
      ...ROOT,
      user?.tenantId,
      context.path,
      context.module,
      context.patientId,
      context.encounterId,
      context.invoiceId,
      context.workflowId,
      context.appointmentId,
      context.inventoryItemId,
      context.reportId,
      context.analyticsDomain,
      locale,
    ],
    [user?.tenantId, context, locale],
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiContextSummary(token, user.tenantId, {
        path: context.path,
        module: context.module,
        patientId: context.patientId,
        encounterId: context.encounterId,
        appointmentId: context.appointmentId,
        invoiceId: context.invoiceId,
        workflowId: context.workflowId,
        inventoryItemId: context.inventoryItemId,
        reportId: context.reportId,
        analyticsDomain: context.analyticsDomain,
        dentalPatientId: context.dentalPatientId,
        beautyPatientId: context.beautyPatientId,
        locale,
      });
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 20_000,
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
  };
}
