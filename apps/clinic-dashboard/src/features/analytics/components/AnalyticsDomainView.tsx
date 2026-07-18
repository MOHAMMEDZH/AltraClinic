import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import type { AnalyticsDomainOverview } from '../api/analytics-api';
import { applyCrossFilterToOverview } from '../lib/apply-analytics-cross-filter';
import { AnalyticsKpiCard } from './AnalyticsKpiCard';
import { AnalyticsChartRenderer } from './AnalyticsChartRenderer';
import { AnalyticsVirtualizedTable } from './AnalyticsVirtualizedTable';
import { useAnalyticsCrossFilter } from './AnalyticsCrossFilterContext';
import { formatAnalyticsKpiValue } from '../lib/format-analytics-kpi';
import styles from '../analytics-layout.module.css';

interface AnalyticsDomainViewProps {
  data?: AnalyticsDomainOverview | null;
  isLoading?: boolean;
  isError?: boolean;
}

export function AnalyticsDomainView({ data, isLoading, isError }: AnalyticsDomainViewProps) {
  const { t, locale } = useI18n();
  const { selection } = useAnalyticsCrossFilter();

  const viewData = useMemo(
    () => (data ? applyCrossFilterToOverview(data, selection) : null),
    [data, selection],
  );

  if (isLoading) {
    return (
      <div className={styles.grid}>
        <WidgetSkeleton span="full" />
        <WidgetSkeleton span="half" />
        <WidgetSkeleton span="half" />
      </div>
    );
  }

  if (isError || !viewData) {
    return <p className={styles.empty}>{t('analytics.loadError')}</p>;
  }

  return (
    <div className={styles.grid}>
      {viewData.kpis.length > 0 && (
        <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="domain-kpis">
          <h2 id="domain-kpis" className={styles.panelTitle}>
            {t('analytics.domain.kpisTitle')}
          </h2>
          <div className={styles.kpiRow}>
            {viewData.kpis.map((kpi) => (
              <AnalyticsKpiCard
                key={kpi.id}
                label={t(kpi.labelKey as 'analytics.title')}
                value={formatAnalyticsKpiValue(kpi, locale)}
                href={kpi.href}
              />
            ))}
          </div>
        </section>
      )}

      {viewData.benchmarks && viewData.benchmarks.length > 0 && (
        <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="domain-benchmarks">
          <h2 id="domain-benchmarks" className={styles.panelTitle}>
            {t('analytics.benchmark.title')}
          </h2>
          <ul className={styles.list}>
            {viewData.benchmarks.map((row) => (
              <li key={row.id} className={styles.listItem}>
                <span>{t(row.labelKey as 'analytics.title')}</span>
                <span>
                  {row.unit === 'currency'
                    ? formatAnalyticsKpiValue({ id: row.id, labelKey: row.labelKey, value: row.current, format: 'currency' }, locale)
                    : formatAnalyticsKpiValue({ id: row.id, labelKey: row.labelKey, value: row.current, format: 'number' }, locale)}
                  {' · '}
                  {t('analytics.benchmark.previous')}{' '}
                  {row.unit === 'currency'
                    ? formatAnalyticsKpiValue({ id: row.id, labelKey: row.labelKey, value: row.previous, format: 'currency' }, locale)
                    : formatAnalyticsKpiValue({ id: row.id, labelKey: row.labelKey, value: row.previous, format: 'number' }, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {viewData.charts.map((chart) => (
        <section key={chart.id} className={[styles.panel, styles.spanHalf].join(' ')}>
          <AnalyticsChartRenderer chart={chart} />
        </section>
      ))}

      {viewData.tables.map((table) => (
        <section key={table.id} className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby={`table-${table.id}`}>
          <h2 id={`table-${table.id}`} className={styles.panelTitle}>
            {t(table.titleKey as 'analytics.title')}
          </h2>
          <AnalyticsVirtualizedTable columns={table.columns} rows={table.rows} />
        </section>
      ))}

      {viewData.kpis.length === 0 && viewData.charts.length === 0 && viewData.tables.length === 0 && (
        <p className={styles.empty}>
          {t('analytics.domain.empty')}{' '}
          <Link to="/reports">{t('analytics.home.openReports')}</Link>
        </p>
      )}
    </div>
  );
}
