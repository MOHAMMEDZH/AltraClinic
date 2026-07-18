import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { canShowDemoOverview } from '@/lib/demo-fallback';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  canSelectDashboardBranch,
  resolveDashboardBranchSelection,
} from '@/features/dashboard/config/dashboard-branch-scope';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useAnalyticsOverview } from './hooks/useAnalyticsOverview';
import { useAnalyticsReports } from './hooks/useAnalyticsReports';
import {
  createDemoOverview,
  type DashboardRange,
} from '@/features/dashboard/api/dashboard-api';
import { runExport } from '@/lib/run-export';
import { downloadDashboardExcel } from '@/features/dashboard/lib/export-dashboard-excel';
import { downloadDashboardWord } from '@/features/dashboard/lib/export-dashboard-word';
import {
  downloadAnalyticsReport,
  generateAnalyticsReport,
} from './api/analytics-api';
import {
  buildDashboardRangeQuery,
  DASHBOARD_PRESET_RANGES,
  defaultCustomRange,
  parseDashboardCustomRangeParams,
  type DashboardCustomRange,
} from '@/features/dashboard/lib/dashboard-range';
import {
  parseDashboardBranchParam,
  parseDashboardRangeParam,
} from '@/features/dashboard/lib/dashboard-drill-down';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPersonName,
  pickLocalizedName,
} from '@/features/dashboard/lib/dashboard-format';
import {
  LazyAppointmentChart,
  LazyPatientGrowthChart,
  LazyRevenueChart,
} from '@/features/dashboard/components/charts/LazyCharts';
import { canViewInventory, formatCurrency as formatInventoryCurrency } from '@/features/inventory/config/inventory-config';
import { useInventoryAnalytics, useInventorySummary } from '@/features/inventory/hooks/useInventory';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import {
  buildAnalyticsUrl,
  metricShowsSection,
  parseAnalyticsMetric,
  type AnalyticsMetric,
} from './lib/analytics-url';
import styles from './analytics-layout.module.css';
import { AnalyticsCategoryNav } from './components/AnalyticsCategoryNav';

const RANGE_OPTIONS = DASHBOARD_PRESET_RANGES;
const METRIC_OPTIONS: AnalyticsMetric[] = ['all', 'revenue', 'appointments', 'patients', 'health'];

export function ExecutiveAnalyticsPage() {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const roles = user?.roles ?? [];
  const canView = hasPermission(roles, 'api.analytics', 'view');
  const canGenerate = hasPermission(roles, 'api.analytics', 'create');
  const canExportReports = hasPermission(roles, 'api.analytics', 'export');
  const canViewInventoryAnalytics = canViewInventory((action) => hasPermission(roles, 'api.inventory', action as never));
  const branchCtx = useOptionalBranch();
  const canSelectBranch =
    branchCtx?.view.canSelectBranch ?? canSelectDashboardBranch(roles);
  const [isGenerating, setIsGenerating] = useState(false);

  const [range, setRange] = useState<DashboardRange>(() =>
    parseDashboardRangeParam(searchParams.get('range')),
  );
  const [customRange, setCustomRange] = useState<DashboardCustomRange>(() =>
    parseDashboardCustomRangeParams(searchParams.get('from'), searchParams.get('to')),
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() =>
    canSelectBranch ? parseDashboardBranchParam(searchParams.get('branchId')) : null,
  );
  const [metric, setMetric] = useState<AnalyticsMetric>(() =>
    parseAnalyticsMetric(searchParams.get('metric')),
  );

  const configuredBranchId =
    branchCtx?.configuration.analytics.defaultBranchFilter ??
    branchCtx?.activeBranchId ??
    user?.branchId;
  const branchId = resolveDashboardBranchSelection(roles, configuredBranchId, selectedBranchId);
  const { data: branches = [] } = useDashboardBranches();
  const showBranchSelect = canSelectBranch && branches.length > 0;

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(buildDashboardRangeQuery(range, customRange))) {
      next.set(key, value);
    }
    if (showBranchSelect) next.set('branchId', selectedBranchId ?? 'all');
    if (metric !== 'all') next.set('metric', metric);
    setSearchParams(next, { replace: true });
  }, [range, customRange, selectedBranchId, metric, showBranchSelect, setSearchParams]);

  useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  const { data, isLoading, isError, refetch, isFetching } = useAnalyticsOverview(
    branchId,
    range,
    range === 'custom' ? customRange : undefined,
  );
  const { data: reports = [], refetch: refetchReports } = useAnalyticsReports(branchId);
  const inventorySummaryQuery = useInventorySummary(canViewInventoryAnalytics);
  const inventoryAnalyticsQuery = useInventoryAnalytics(30, canViewInventoryAnalytics);
  const isDemo = canShowDemoOverview(online, isError, Boolean(data));
  const overview = data ?? (isDemo ? createDemoOverview(range, customRange) : null);

  const handleGenerateReport = useCallback(async () => {
    if (!user?.tenantId || isDemo) return;
    setIsGenerating(true);
    try {
      const token = await getValidAccessToken();
      if (!token) return;
      await generateAnalyticsReport(
        token,
        {
          name: `${t('analytics.title')} (${t(`dashboard.range.${range}`)})`,
          reportType: 'financial',
          format: 'excel',
          parameters:
            range === 'custom'
              ? { range, from: customRange.from, to: customRange.to, locale }
              : { range, locale },
          branchId: branchId ?? undefined,
        },
        user.tenantId,
      );
      await queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
      await refetchReports();
    } finally {
      setIsGenerating(false);
    }
  }, [
    user?.tenantId,
    isDemo,
    getValidAccessToken,
    t,
    range,
    branchId,
    customRange,
    locale,
    queryClient,
    refetchReports,
  ]);

  const handleDownloadReport = useCallback(
    async (reportId: string, name: string, format: string) => {
      if (!user?.tenantId) return;
      const token = await getValidAccessToken();
      if (!token) return;
      const ext = format === 'json' ? 'json' : format === 'excel' ? 'xlsx' : format;
      const safeName = name.replace(/[^\w\s-]/g, '').trim() || 'report';
      await downloadAnalyticsReport(token, reportId, `${safeName}.${ext}`, user.tenantId);
    },
    [user?.tenantId, getValidAccessToken],
  );

  const branchLabel = useMemo(() => {
    if (!showBranchSelect) {
      const own = branches.find((b) => b.id === user?.branchId);
      return own?.name ?? t('dashboard.branch.current');
    }
    if (selectedBranchId === null) return t('dashboard.branch.all');
    return branches.find((b) => b.id === selectedBranchId)?.name ?? t('dashboard.branch.all');
  }, [showBranchSelect, selectedBranchId, branches, user?.branchId, t]);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('analytics.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link className={styles.backLink} to="/analytics">
            <ArrowLeft size={16} aria-hidden />
            {t('analytics.home.backToHub')}
          </Link>
          <h1 className={styles.title}>{t('analytics.domains.executive.title')}</h1>
          <p className={styles.subtitle}>{t('analytics.domains.executive.desc')}</p>
          <p className={styles.meta}>
            {t(`dashboard.range.${range}`)} · {branchLabel}
          </p>
        </div>

        <div className={styles.toolbar}>
          {showBranchSelect && (
            <label className={styles.branchWrap}>
              <span className={styles.visuallyHidden}>{t('dashboard.branch.label')}</span>
              <select
                className={styles.select}
                value={selectedBranchId ?? 'all'}
                onChange={(e) =>
                  setSelectedBranchId(e.target.value === 'all' ? null : e.target.value)
                }
                aria-label={t('dashboard.branch.label')}
              >
                <option value="all">{t('dashboard.branch.all')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={styles.chipGroup} role="group" aria-label={t('analytics.rangeLabel')}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={[styles.chip, range === option ? styles.chipActive : ''].join(' ')}
                aria-pressed={range === option}
                onClick={() => {
                  setRange(option);
                  if (option === 'custom') {
                    setCustomRange((current) =>
                      current.from && current.to ? current : defaultCustomRange(),
                    );
                  }
                }}
              >
                {t(`dashboard.range.${option}`)}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className={styles.customRangeGroup}>
              <label className={styles.customRangeField}>
                <span className={styles.customRangeLabel}>{t('dashboard.customRangeFrom')}</span>
                <input
                  type="date"
                  className={styles.select}
                  value={customRange.from}
                  max={customRange.to}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                  aria-label={t('dashboard.customRangeFrom')}
                />
              </label>
              <label className={styles.customRangeField}>
                <span className={styles.customRangeLabel}>{t('dashboard.customRangeTo')}</span>
                <input
                  type="date"
                  className={styles.select}
                  value={customRange.to}
                  min={customRange.from}
                  onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                  aria-label={t('dashboard.customRangeTo')}
                />
              </label>
            </div>
          )}

          <div className={styles.chipGroup} role="group" aria-label={t('analytics.metricLabel')}>
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={[styles.chip, metric === option ? styles.chipActive : ''].join(' ')}
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
              >
                {t(`analytics.metrics.${option}`)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.toolBtn}
            disabled={!overview}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardExcel(overview, t('analytics.title'), locale, 'analytics'),
                'Excel export failed',
              )
            }
          >
            <Download size={16} />
            {t('analytics.exportExcel')}
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            disabled={!overview}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardWord(overview, t('analytics.title'), locale, 'analytics'),
                'Word export failed',
              )
            }
          >
            <Download size={16} />
            {t('analytics.exportWord')}
          </button>
          {canGenerate && !isDemo && (
            <button
              type="button"
              className={styles.toolBtn}
              disabled={isGenerating}
              onClick={() => void handleGenerateReport()}
            >
              <Download size={16} />
              {isGenerating ? t('analytics.generatingReport') : t('analytics.generateReport')}
            </button>
          )}
          <button type="button" className={styles.toolBtn} onClick={() => void refetch()}>
            <RefreshCw size={16} className={isFetching ? styles.spin : undefined} />
            {t('analytics.refresh')}
          </button>
        </div>
      </header>

      <AnalyticsCategoryNav activeDomain="executive" />

      {isDemo && online && (
        <p className={styles.demoNote} role="status">
          {t('analytics.demoNote')}
        </p>
      )}

      {isError && !isDemo && !isLoading && !overview && (
        <AuthAlert variant="error">{t('analytics.loadError')}</AuthAlert>
      )}

      <div id="analytics-region" className={styles.grid} aria-label={t('analytics.title')}>
        {isLoading ? (
          <>
            <WidgetSkeleton span="half" />
            <WidgetSkeleton span="half" />
            <WidgetSkeleton span="full" />
          </>
        ) : !overview ? (
          isError && !isDemo ? null : (
            <>
              <WidgetSkeleton span="half" />
              <WidgetSkeleton span="half" />
              <WidgetSkeleton span="full" />
            </>
          )
        ) : (
          <>
            {metricShowsSection(metric, 'revenue') && (
              <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="analytics-revenue">
                <h2 id="analytics-revenue" className={styles.panelTitle}>
                  {t('analytics.sections.revenue')}
                </h2>
                <div className={styles.kpiRow}>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('analytics.kpis.revenueToday')}</p>
                    <p className={styles.kpiValue}>
                      {formatCurrency(overview.kpis.revenueToday, locale)}
                    </p>
                  </article>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('analytics.kpis.revenueMonth')}</p>
                    <p className={styles.kpiValue}>
                      {formatCurrency(overview.kpis.revenueMonth, locale)}
                    </p>
                  </article>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('analytics.kpis.outstanding')}</p>
                    <p className={styles.kpiValue}>
                      {formatCurrency(overview.kpis.outstandingAmount, locale)}
                    </p>
                  </article>
                </div>
                <div className={styles.chart}>
                  <LazyRevenueChart data={overview.revenueTrend} locale={locale} />
                </div>
              </section>
            )}

            {metricShowsSection(metric, 'appointments') && (
              <section className={[styles.panel, styles.spanHalf].join(' ')} aria-labelledby="analytics-appt">
                <h2 id="analytics-appt" className={styles.panelTitle}>
                  {t('analytics.sections.appointments')}
                </h2>
                <p className={styles.kpiValue}>
                  {formatNumber(overview.kpis.appointmentsToday, locale)}
                </p>
                <p className={styles.kpiHint}>{t('analytics.kpis.appointmentsToday')}</p>
                <div className={styles.chart}>
                  <LazyAppointmentChart data={overview.appointmentTrend} />
                </div>
              </section>
            )}

            {metricShowsSection(metric, 'patients') && (
              <section className={[styles.panel, styles.spanHalf].join(' ')} aria-labelledby="analytics-patients">
                <h2 id="analytics-patients" className={styles.panelTitle}>
                  {t('analytics.sections.patients')}
                </h2>
                <p className={styles.kpiValue}>
                  {formatNumber(overview.live.newPatientsToday, locale)}
                </p>
                <p className={styles.kpiHint}>{t('analytics.kpis.newPatients')}</p>
                <div className={styles.chart}>
                  <LazyPatientGrowthChart data={overview.patientGrowthTrend} />
                </div>
              </section>
            )}

            {metricShowsSection(metric, 'health') && (
              <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="analytics-health">
                <h2 id="analytics-health" className={styles.panelTitle}>
                  {t('analytics.sections.health')}
                </h2>
                <div className={styles.healthRow}>
                  <article className={styles.healthCard}>
                    <p className={styles.kpiLabel}>{t('dashboard.health.utilization')}</p>
                    <p className={styles.healthValue}>
                      {formatPercent(overview.businessHealth.utilizationPercent, locale)}
                    </p>
                  </article>
                  <article className={styles.healthCard}>
                    <p className={styles.kpiLabel}>{t('dashboard.health.collection')}</p>
                    <p className={styles.healthValue}>
                      {formatPercent(overview.businessHealth.collectionPercent, locale)}
                    </p>
                  </article>
                  <article className={styles.healthCard}>
                    <p className={styles.kpiLabel}>{t('dashboard.health.noShow')}</p>
                    <p className={styles.healthValue}>
                      {formatPercent(overview.businessHealth.noShowPercent, locale)}
                    </p>
                  </article>
                  <article className={styles.healthCard}>
                    <p className={styles.kpiLabel}>{t('analytics.kpis.queue')}</p>
                    <p className={styles.healthValue}>
                      {formatNumber(overview.kpis.queueWaiting, locale)}
                    </p>
                  </article>
                </div>
              </section>
            )}

            {metricShowsSection(metric, 'appointments') && overview.branchPerformance.length > 0 && (
              <section className={[styles.panel, styles.spanHalf].join(' ')} aria-labelledby="analytics-branches">
                <h2 id="analytics-branches" className={styles.panelTitle}>
                  {t('analytics.sections.branches')}
                </h2>
                <ul className={styles.list}>
                  {overview.branchPerformance.map((branch) => (
                    <li key={branch.branchId} className={styles.listItem}>
                      <Link to={buildAnalyticsUrl(range, branch.branchId, metric)}>
                        <span>{pickLocalizedName(locale, branch.name, branch.nameAr)}</span>
                        <span>
                          {formatNumber(branch.appointments, locale)} ·{' '}
                          {formatCurrency(branch.revenue, locale)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {metricShowsSection(metric, 'patients') && overview.doctorPerformance.length > 0 && (
              <section className={[styles.panel, styles.spanHalf].join(' ')} aria-labelledby="analytics-doctors">
                <h2 id="analytics-doctors" className={styles.panelTitle}>
                  {t('analytics.sections.doctors')}
                </h2>
                <ul className={styles.list}>
                  {overview.doctorPerformance.map((doc) => (
                    <li key={doc.providerId} className={styles.listItem}>
                      <span>
                        {formatPersonName(
                          locale,
                          doc.firstName,
                          doc.lastName,
                          doc.firstNameAr,
                          doc.lastNameAr,
                        )}
                      </span>
                      <span>
                        {formatNumber(doc.appointments, locale)} /{' '}
                        {formatNumber(doc.encounters, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {canViewInventoryAnalytics && inventorySummaryQuery.data && (
              <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="analytics-inventory">
                <h2 id="analytics-inventory" className={styles.panelTitle}>
                  {t('pages.reports.inventoryCardTitle')}
                </h2>
                <p className={styles.kpiHint}>
                  <Link to="/inventory/reports">{t('inventory.dashboard.viewReports')}</Link>
                </p>
                <div className={styles.kpiRow}>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('inventory.metrics.stockValue')}</p>
                    <p className={styles.kpiValue}>
                      {formatInventoryCurrency(inventorySummaryQuery.data.stockValue, locale)}
                    </p>
                  </article>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('inventory.metrics.lowStock')}</p>
                    <p className={styles.kpiValue}>{inventorySummaryQuery.data.lowStockCount}</p>
                  </article>
                  <article className={styles.kpi}>
                    <p className={styles.kpiLabel}>{t('inventory.metrics.outOfStock')}</p>
                    <p className={styles.kpiValue}>{inventorySummaryQuery.data.outOfStockCount}</p>
                  </article>
                  {inventoryAnalyticsQuery.data && (
                    <article className={styles.kpi}>
                      <p className={styles.kpiLabel}>{t('inventory.dashboard.consumed30d')}</p>
                      <p className={styles.kpiValue}>{inventoryAnalyticsQuery.data.consumption.totalQuantity}</p>
                    </article>
                  )}
                </div>
              </section>
            )}

            <section className={[styles.panel, styles.spanFull].join(' ')} aria-labelledby="analytics-reports">
              <h2 id="analytics-reports" className={styles.panelTitle}>
                {t('analytics.sections.reports')}
              </h2>
              {reports.length === 0 ? (
                <p className={styles.kpiHint}>{t('analytics.reportsEmpty')}</p>
              ) : (
                <ul className={styles.list}>
                  {reports.map((report) => (
                    <li key={report.reportId} className={styles.listItem}>
                      <div>
                        <span>{report.name}</span>
                        {report.description && (
                          <p className={styles.kpiHint}>{report.description}</p>
                        )}
                      </div>
                      <div className={styles.reportActions}>
                        <span>
                          {report.format.toUpperCase()} · {report.status}
                        </span>
                        {report.status === 'completed' && canExportReports && !isDemo && (
                          <button
                            type="button"
                            className={styles.reportDownloadBtn}
                            onClick={() =>
                              void handleDownloadReport(report.reportId, report.name, report.format)
                            }
                          >
                            {t('analytics.downloadReport')}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use ExecutiveAnalyticsPage — kept for backward compatibility */
export const AnalyticsPage = ExecutiveAnalyticsPage;
