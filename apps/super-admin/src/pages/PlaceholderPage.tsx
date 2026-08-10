import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { EmptyState } from '../ui/EmptyState';
import { getRouteById, type SuperAdminRouteId } from '../routing/route-registry';

interface PlaceholderPageProps {
  routeId: SuperAdminRouteId;
}

/**
 * Safe administrative placeholder for routes whose business-domain
 * implementation lands in a later step. Never renders tenant data, metrics,
 * or clinical content.
 */
export function PlaceholderPage({ routeId }: PlaceholderPageProps) {
  const { t } = useI18n();
  const route = getRouteById(routeId);
  const title = route ? t(route.titleKey) : routeId;
  const description = route?.descriptionKey ? t(route.descriptionKey) : undefined;
  const stepNote = route?.step
    ? `${t('placeholder.availableInStepPrefix', 'Available in Step')} ${route.step}.`
    : undefined;

  return (
    <PageLayout title={title} description={description}>
      <EmptyState title={t('common.states.emptyTitle', 'Nothing here yet')} description={stepNote} />
    </PageLayout>
  );
}
