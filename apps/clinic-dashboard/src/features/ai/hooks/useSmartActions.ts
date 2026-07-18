import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { fetchAiSmartActions } from '../api/ai-api';

import { useAiRouteContext } from './useAiContext';



const ROOT = ['ai', 'smart-actions'] as const;



export function useSmartAiActions(enabled = true) {

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

      return fetchAiSmartActions(token, user.tenantId, {

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

    staleTime: 30_000,

  });



  return {

    actions: query.data?.actions ?? [],

    isLoading: query.isLoading,

  };

}


