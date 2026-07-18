import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, FileText, Search, Star } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { canShowDemoOverview } from '@/lib/demo-fallback';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { createDemoOverview } from '@/features/dashboard/api/dashboard-api';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  pickLocalizedName,
} from '@/features/dashboard/lib/dashboard-format';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { FeatureGate } from '@/features/subscription/components/FeatureGate';
import { LazyRevenueChart } from '@/features/dashboard/components/charts/LazyCharts';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import {
  findAnalyticsDomainInSnapshot,
  snapshotDomainsToAnalyticsDomains,
} from '@/features/dynamic-analytics/lib/analytics-domain-adapter';
import {
  buildAnalyticsPermCheck,
  canViewAnalyticsDomain,
} from './config/analytics-config';
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters';
import { useAnalyticsOverview } from './hooks/useAnalyticsOverview';
import { useAnalyticsFavorites, useAnalyticsRecents } from './hooks/useAnalyticsPreferences';
import { useAnalyticsAlerts } from './hooks/useAnalyticsAlerts';
import { AnalyticsCategoryNav } from './components/AnalyticsCategoryNav';
import { AnalyticsKpiCard } from './components/AnalyticsKpiCard';
import { AnalyticsQuickFilters } from './components/AnalyticsQuickFilters';
import styles from './analytics-layout.module.css';

export function AnalyticsHomePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useMemo(() => buildAnalyticsPermCheck(roles), [roles]);
  const { snapshot, isRegistrySource, canViewAnalytics: canView } = useDynamicAnalytics();
  const analyticsDomains = useMemo(() => snapshotDomainsToAnalyticsDomains(snapshot), [snapshot]);

  const canViewDomain = useMemo(
    () => (domainId: string) =>
      isRegistrySource
        ? Boolean(findAnalyticsDomainInSnapshot(snapshot, domainId))
        : canViewAnalyticsDomain(domainId as never, perm),
    [isRegistrySource, snapshot, perm],
  );

  const [search, setSearch] = useState('');
  const filters = useAnalyticsFilters(roles, user?.branchId);
  const { favorites, toggleFavorite, isFavorite } = useAnalyticsFavorites();
  const { recents, trackRecent } = useAnalyticsRecents();

  const { data, isLoading, isError } = useAnalyticsOverview(
    filters.branchId,
    filters.range,
    filters.range === 'custom' ? filters.customRange : undefined,
  );
  const alertsQuery = useAnalyticsAlerts(
    filters.branchId,
    filters.range,
    filters.range === 'custom' ? filters.customRange : undefined,
    canView,
  );
  const isDemo = canShowDemoOverview(online, isError, Boolean(data));
  const overview = data ?? (isDemo ? createDemoOverview(filters.range, filters.customRange) : null);

  const visibleDomains = useMemo(
    () =>
      analyticsDomains.filter((domain) => {
        if (!canViewDomain(domain.id)) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const title = t(domain.titleKey as 'analytics.title').toLowerCase();
        const desc = t(domain.descriptionKey as 'analytics.subtitle').toLowerCase();
        return title.includes(q) || desc.includes(q);
      }),
    [analyticsDomains, canViewDomain, search, t],
  );

  const favoriteDomains = useMemo(
    () =>
      favorites
        .map((id) => findAnalyticsDomainInSnapshot(snapshot, id))
        .filter((domain) => domain && canViewDomain(domain.id)),
    [favorites, snapshot, canViewDomain],
  );

  const recentDomains = useMemo(
    () =>
      recents
        .map((id) => findAnalyticsDomainInSnapshot(snapshot, id))
        .filter((domain) => domain && canViewDomain(domain.id)),
    [recents, snapshot, canViewDomain],
  );

  const alerts = useMemo(() => {
    if (alertsQuery.data?.length) {
      return alertsQuery.data.map((alert) => t(alert.messageKey as 'analytics.title'));
    }
    if (!overview) return [];
    const items: string[] = [];
    if (overview.businessHealth.noShowPercent > 15) {
      items.push(t('analytics.home.alerts.highNoShow'));
    }
    if (overview.businessHealth.collectionPercent < 70) {
      items.push(t('analytics.home.alerts.lowCollection'));
    }
    if (overview.kpis.outstandingAmount > overview.kpis.revenueMonth * 0.3) {
      items.push(t('analytics.home.alerts.highOutstanding'));
    }
    if (overview.businessHealth.utilizationPercent < 50) {
      items.push(t('analytics.home.alerts.lowUtilization'));
    }
    return items;
  }, [alertsQuery.data, overview, t]);

  useEffect(() => {
    document.title = t('analytics.home.title');
  }, [t]);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('analytics.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const openDomain = (domainId: string, route: string) => {
    trackRecent(domainId);
    navigate(route);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t('analytics.home.title')}</h1>
          <p className={styles.subtitle}>{t('analytics.home.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.quickNavLink} to="/reports">
            <FileText size={16} aria-hidden />
            {t('analytics.home.openReports')}
          </Link>
          <Link className={styles.quickNavLink} to="/analytics/executive">
            <BarChart3 size={16} aria-hidden />
            {t('analytics.home.executiveDashboard')}
          </Link>
          <Link className={styles.quickNavLink} to="/analytics/builder">
            <BarChart3 size={16} aria-hidden />
            {t('analytics.builder.nav')}
          </Link>
          <Link className={styles.quickNavLink} to="/analytics/export">
            <FileText size={16} aria-hidden />
            {t('analytics.export.nav')}
          </Link>
        </div>
      </header>

      <AnalyticsCategoryNav activeDomain="home" />

      <label className={styles.toolbar}>
        <span className={styles.visuallyHidden}>{t('analytics.home.searchLabel')}</span>
        <Search size={16} aria-hidden />
        <input
          type="search"
          className={styles.chip}
          value={search}
          placeholder={t('analytics.home.searchPlaceholder')}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('analytics.home.searchLabel')}
        />
      </label>

      <AnalyticsQuickFilters
        range={filters.range}
        onRangeChange={filters.setRange}
        customRange={filters.customRange}
        onCustomRangeChange={filters.setCustomRange}
        selectedBranchId={filters.selectedBranchId}
        onBranchChange={filters.setSelectedBranchId}
        canSelectBranch={filters.canSelectBranch}
      />

      {isDemo && online && (
        <p className={styles.demoNote} role="status">
          {t('analytics.demoNote')}
        </p>
      )}

      {alerts.length > 0 && (
        <section className={styles.alertBanner} aria-labelledby="analytics-alerts">
          <h2 id="analytics-alerts" className={styles.panelTitle}>
            {t('analytics.home.alertsTitle')}
          </h2>
          <ul className={styles.list}>
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </section>
      )}

      <FeatureGate
        featureId="analytics"
        featureName={t('subscription.features.analytics')}
        benefits={[t('subscription.locked.benefitAutomation')]}
        preview
      >
      <div id="analytics-region" aria-label={t('analytics.home.title')}>
        <section className={styles.panel} aria-labelledby="analytics-executive-summary">
          <h2 id="analytics-executive-summary" className={styles.panelTitle}>
            {t('analytics.home.executiveSummary')}
          </h2>
        {isError && !isDemo && !isLoading && !overview && (
          <AuthAlert variant="error">{t('analytics.loadError')}</AuthAlert>
        )}
        {isLoading ? (
          <div className={styles.kpiRow}>
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
          </div>
        ) : !overview ? (
          isError && !isDemo ? null : (
            <div className={styles.kpiRow}>
              <WidgetSkeleton span="third" />
              <WidgetSkeleton span="third" />
              <WidgetSkeleton span="third" />
            </div>
          )
        ) : (
          <>
            <div className={styles.kpiRow}>
              <AnalyticsKpiCard
                label={t('analytics.kpis.revenueMonth')}
                value={formatCurrency(overview.kpis.revenueMonth, locale)}
                hint={t('analytics.home.kpiHintRevenue')}
                href="/analytics/financial"
              />
              <AnalyticsKpiCard
                label={t('analytics.kpis.appointmentsToday')}
                value={formatNumber(overview.kpis.appointmentsToday, locale)}
                hint={t('analytics.home.kpiHintAppointments')}
                href="/analytics/operations"
              />
              <AnalyticsKpiCard
                label={t('analytics.kpis.newPatients')}
                value={formatNumber(overview.live.newPatientsToday, locale)}
                hint={t('analytics.home.kpiHintPatients')}
                href="/analytics/patients"
              />
              <AnalyticsKpiCard
                label={t('dashboard.health.collection')}
                value={formatPercent(overview.businessHealth.collectionPercent, locale)}
                hint={t('analytics.home.kpiHintCollection')}
                href="/analytics/financial"
              />
              <AnalyticsKpiCard
                label={t('dashboard.health.utilization')}
                value={formatPercent(overview.businessHealth.utilizationPercent, locale)}
                hint={t('analytics.home.kpiHintUtilization')}
                href="/analytics/operations"
              />
              <AnalyticsKpiCard
                label={t('analytics.kpis.outstanding')}
                value={formatCurrency(overview.kpis.outstandingAmount, locale)}
                hint={t('analytics.home.kpiHintOutstanding')}
                href="/analytics/financial"
              />
            </div>
            <div className={styles.chart}>
              <LazyRevenueChart data={overview.revenueTrend} locale={locale} />
            </div>
          </>
        )}
      </section>
      </div>
      </FeatureGate>

      {favoriteDomains.length > 0 && (
        <section className={styles.panel} aria-labelledby="analytics-favorites">
          <h2 id="analytics-favorites" className={styles.panelTitle}>
            {t('analytics.home.favorites')}
          </h2>
          <div className={styles.domainGrid}>
            {favoriteDomains.map((domain) =>
              domain ? (
                <button
                  key={domain.id}
                  type="button"
                  className={styles.domainCard}
                  onClick={() => openDomain(domain.id, domain.route)}
                >
                  <Star size={16} aria-hidden fill="currentColor" />
                  <h3 className={styles.domainTitle}>{t(domain.titleKey as 'analytics.title')}</h3>
                  <p className={styles.domainDesc}>{t(domain.descriptionKey as 'analytics.subtitle')}</p>
                </button>
              ) : null,
            )}
          </div>
        </section>
      )}

      {recentDomains.length > 0 && (
        <section className={styles.panel} aria-labelledby="analytics-recents">
          <h2 id="analytics-recents" className={styles.panelTitle}>
            {t('analytics.home.recents')}
          </h2>
          <ul className={styles.list}>
            {recentDomains.map((domain) =>
              domain ? (
                <li key={domain.id} className={styles.listItem}>
                  <Link to={domain.route} onClick={() => trackRecent(domain.id)}>
                    <span>{t(domain.titleKey as 'analytics.title')}</span>
                    <span>{t(domain.descriptionKey as 'analytics.subtitle')}</span>
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="analytics-domains">
        <h2 id="analytics-domains" className={styles.panelTitle}>
          {t('analytics.home.domainsTitle')}
        </h2>
        {visibleDomains.length === 0 ? (
          <p className={styles.empty}>{t('analytics.home.noResults')}</p>
        ) : (
          <div className={styles.domainGrid}>
            {visibleDomains.map((domain) => (
              <article key={domain.id} className={styles.domainCard}>
                <button
                  type="button"
                  style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 'var(--space-2)' }}
                  onClick={() => openDomain(domain.id, domain.route)}
                >
                  <h3 className={styles.domainTitle}>{t(domain.titleKey as 'analytics.title')}</h3>
                  <p className={styles.domainDesc}>{t(domain.descriptionKey as 'analytics.subtitle')}</p>
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  aria-pressed={isFavorite(domain.id)}
                  aria-label={
                    isFavorite(domain.id)
                      ? t('analytics.home.removeFavorite')
                      : t('analytics.home.addFavorite')
                  }
                  onClick={() => toggleFavorite(domain.id)}
                >
                  <Star size={16} fill={isFavorite(domain.id) ? 'currentColor' : 'none'} aria-hidden />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {overview && overview.branchPerformance.length > 0 && (
        <section className={styles.panel} aria-labelledby="analytics-branch-snapshot">
          <h2 id="analytics-branch-snapshot" className={styles.panelTitle}>
            {t('analytics.home.branchSnapshot')}
          </h2>
          <ul className={styles.list}>
            {overview.branchPerformance.slice(0, 5).map((branch) => (
              <li key={branch.branchId} className={styles.listItem}>
                <Link to="/analytics/branches">
                  <span>{pickLocalizedName(locale, branch.name, branch.nameAr)}</span>
                  <span>
                    {formatNumber(branch.appointments, locale)} · {formatCurrency(branch.revenue, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="analytics-recommendations">
        <h2 id="analytics-recommendations" className={styles.panelTitle}>
          {t('analytics.home.recommendationsTitle')}
        </h2>
        <ul className={styles.list}>
          <li>{t('analytics.home.recommendations.reviewNoShows')}</li>
          <li>{t('analytics.home.recommendations.optimizeSchedule')}</li>
          <li>{t('analytics.home.recommendations.trackInventory')}</li>
        </ul>
      </section>
    </div>
  );
}
