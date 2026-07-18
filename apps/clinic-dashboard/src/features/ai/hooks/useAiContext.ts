import { useMemo } from 'react';
import { useLocation, useMatch, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { contextSummary, parseAiRouteContext } from '../lib/ai-context';

export function useAiRouteContext() {
  const { pathname } = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const patientMatch = useMatch('/patients/:patientId');
  const encounterMatch = useMatch('/encounters/:encounterId');
  const invoiceMatch = useMatch('/billing/invoices/:invoiceId');
  const workflowMatch = useMatch('/workflows/instances/:workflowId');
  const inventoryMatch = useMatch('/inventory/items/:itemId');
  const reportMatch = useMatch('/reports/:reportId');
  const dentalMatch = useMatch('/dental/chart/:patientId');
  const beautyMatch = useMatch('/beauty/workspace/:patientId');

  return useMemo(
    () =>
      parseAiRouteContext(pathname, {
        patientId:
          params.patientId ??
          patientMatch?.params.patientId ??
          dentalMatch?.params.patientId ??
          beautyMatch?.params.patientId,
        encounterId: params.encounterId ?? encounterMatch?.params.encounterId,
        invoiceId: params.invoiceId ?? invoiceMatch?.params.invoiceId,
        workflowId: params.workflowId ?? workflowMatch?.params.workflowId,
        itemId: params.itemId ?? inventoryMatch?.params.itemId,
        reportId: params.reportId ?? reportMatch?.params.reportId,
        appointmentId: params.appointmentId,
      }, searchParams),
    [
      pathname,
      params,
      searchParams,
      patientMatch,
      encounterMatch,
      invoiceMatch,
      workflowMatch,
      inventoryMatch,
      reportMatch,
      dentalMatch,
      beautyMatch,
    ],
  );
}

export function useAiContextLabel() {
  const { locale } = useI18n();
  const context = useAiRouteContext();
  return useMemo(() => contextSummary(context, locale), [context, locale]);
}
