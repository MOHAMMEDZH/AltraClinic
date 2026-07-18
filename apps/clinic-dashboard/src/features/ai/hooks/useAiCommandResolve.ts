import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchAiCommandResolve, type AiCommandResolveItemDto } from '../api/ai-api';
import { buildLocalCommandFallback } from '../lib/ai-command-fallback';
import { useAiRouteContext } from './useAiContext';

const ROOT = ['ai', 'commands', 'resolve'] as const;

export function useAiCommandResolve(query: string, enabled = true) {
  const { locale } = useI18n();
  const context = useAiRouteContext();
  const { getValidAccessToken, user } = useAuth();
  const trimmed = query.trim();

  const queryKey = useMemo(
    () => [
      ...ROOT,
      user?.tenantId,
      trimmed,
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
    [user?.tenantId, trimmed, context, locale],
  );

  const result = useQuery({
    queryKey,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiCommandResolve(token, user.tenantId, {
        q: trimmed,
        path: context.path,
        module: context.module,
        patientId: context.patientId,
        encounterId: context.encounterId,
        invoiceId: context.invoiceId,
        workflowId: context.workflowId,
        appointmentId: context.appointmentId,
        inventoryItemId: context.inventoryItemId,
        reportId: context.reportId,
        analyticsDomain: context.analyticsDomain,
        locale,
      });
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 10_000,
    retry: 1,
  });

  const fallbackItems = useMemo(
    () => (result.isError ? buildLocalCommandFallback(trimmed) : []),
    [result.isError, trimmed],
  );

  return {
    items: (result.data?.items ?? fallbackItems) as AiCommandResolveItemDto[],
    isLoading: result.isLoading,
    isFallback: result.isError,
  };
}
