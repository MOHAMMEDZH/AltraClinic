import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { AnalyticsDomainId } from '../config/analytics-catalog';
import { AnalyticsCategoryNav } from './AnalyticsCategoryNav';
import { AnalyticsQuickFilters } from './AnalyticsQuickFilters';
import { useAnalyticsRecents } from '../hooks/useAnalyticsPreferences';
import type { DashboardCustomRange, DashboardRange } from '@/features/dashboard/api/dashboard-api';
import styles from '../analytics-layout.module.css';

interface AnalyticsDomainShellProps {
  activeDomain: AnalyticsDomainId;
  titleKey: string;
  subtitleKey: string;
  children: ReactNode;
  headerActions?: ReactNode;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  customRange: DashboardCustomRange;
  onCustomRangeChange: (range: DashboardCustomRange) => void;
  selectedBranchId: string | null;
  onBranchChange: (branchId: string | null) => void;
  canSelectBranch: boolean;
  meta?: string;
}

export function AnalyticsDomainShell({
  activeDomain,
  titleKey,
  subtitleKey,
  children,
  headerActions,
  range,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  selectedBranchId,
  onBranchChange,
  canSelectBranch,
  meta,
}: AnalyticsDomainShellProps) {
  const { t } = useI18n();
  const { trackRecent } = useAnalyticsRecents();

  useEffect(() => {
    trackRecent(activeDomain);
  }, [activeDomain, trackRecent]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link className={styles.backLink} to="/analytics">
            <ArrowLeft size={16} aria-hidden />
            {t('analytics.home.backToHub')}
          </Link>
          <h1 className={styles.title}>{t(titleKey as 'analytics.title')}</h1>
          <p className={styles.subtitle}>{t(subtitleKey as 'analytics.subtitle')}</p>
          {meta ? <p className={styles.meta}>{meta}</p> : null}
        </div>
        {headerActions ? <div className={styles.headerActions}>{headerActions}</div> : null}
      </header>

      <AnalyticsCategoryNav activeDomain={activeDomain} />

      <AnalyticsQuickFilters
        range={range}
        onRangeChange={onRangeChange}
        customRange={customRange}
        onCustomRangeChange={onCustomRangeChange}
        selectedBranchId={selectedBranchId}
        onBranchChange={onBranchChange}
        canSelectBranch={canSelectBranch}
      />

      {children}
    </div>
  );
}
