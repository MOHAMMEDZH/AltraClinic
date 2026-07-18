import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import type { AnalyticsDomainId } from '../config/analytics-catalog';
import { buildAnalyticsPermCheck, canViewAnalyticsDomain } from '../config/analytics-config';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import { isDomainVisibleInSnapshot } from '@/features/dynamic-analytics/lib/analytics-domain-adapter';
import { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';
import { useAnalyticsDomain } from '../hooks/useAnalyticsDomain';
import { AnalyticsDomainShell } from './AnalyticsDomainShell';
import { AnalyticsDomainView } from './AnalyticsDomainView';
import { AnalyticsSavedFiltersPanel } from './AnalyticsSavedFiltersPanel';
import { AnalyticsCrossFilterProvider } from './AnalyticsCrossFilterContext';
import { AnalyticsCrossFilterBar } from './AnalyticsCrossFilterBar';
import styles from '../analytics-layout.module.css';

interface AnalyticsDomainPageProps {
  domainId: AnalyticsDomainId;
  titleKey: string;
  subtitleKey: string;
}

export function AnalyticsDomainPage({ domainId, titleKey, subtitleKey }: AnalyticsDomainPageProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useMemo(() => buildAnalyticsPermCheck(roles), [roles]);
  const { snapshot, isRegistrySource } = useDynamicAnalytics();
  const canView = isRegistrySource
    ? isDomainVisibleInSnapshot(snapshot, domainId)
    : canViewAnalyticsDomain(domainId, perm);
  const filters = useAnalyticsFilters(roles, user?.branchId);
  const domainQuery = useAnalyticsDomain(
    domainId,
    filters.branchId,
    filters.range,
    filters.range === 'custom' ? filters.customRange : undefined,
    canView,
  );

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('analytics.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <AnalyticsCrossFilterProvider>
      <AnalyticsDomainShell
        activeDomain={domainId}
        titleKey={titleKey}
        subtitleKey={subtitleKey}
        range={filters.range}
        onRangeChange={filters.setRange}
        customRange={filters.customRange}
        onCustomRangeChange={filters.setCustomRange}
        selectedBranchId={filters.selectedBranchId}
        onBranchChange={filters.setSelectedBranchId}
        canSelectBranch={filters.canSelectBranch}
        headerActions={<AnalyticsSavedFiltersPanel filters={filters} />}
      >
        <AnalyticsCrossFilterBar />
        <AnalyticsDomainView
          data={domainQuery.data}
          isLoading={domainQuery.isLoading}
          isError={domainQuery.isError}
        />
        {(domainId === 'clinical' || domainId === 'dental' || domainId === 'beauty') && (
          <p className={styles.kpiHint}>
            <Link to={domainId === 'clinical' ? '/emr' : `/${domainId}`}>
              {t(`analytics.${domainId}.openWorkspace`)}
            </Link>
          </p>
        )}
      </AnalyticsDomainShell>
    </AnalyticsCrossFilterProvider>
  );
}
