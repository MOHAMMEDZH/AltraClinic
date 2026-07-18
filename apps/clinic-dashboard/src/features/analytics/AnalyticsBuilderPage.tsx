import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Plus, Save } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import { snapshotWidgetsToCatalogItems } from '@/features/dynamic-analytics/lib/analytics-domain-adapter';
import { buildAnalyticsPermCheck, canCreateAnalytics } from './config/analytics-config';
import { useAnalyticsDashboardBuilder } from './hooks/useAnalyticsDashboardBuilder';
import { AnalyticsCategoryNav } from './components/AnalyticsCategoryNav';
import { AnalyticsGridBuilder, makeWidgetDraggable } from './components/AnalyticsGridBuilder';
import { autoPackGridLayout, type AnalyticsGridItem } from './lib/analytics-grid-layout';
import styles from './analytics-layout.module.css';

export function AnalyticsBuilderPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useMemo(() => buildAnalyticsPermCheck(roles), [roles]);
  const { snapshot, isRegistrySource, canCreateDashboards } = useDynamicAnalytics();
  const widgetCatalog = useMemo(() => snapshotWidgetsToCatalogItems(snapshot), [snapshot]);
  const canCreate = isRegistrySource ? canCreateDashboards : canCreateAnalytics(perm);

  const [dashboardName, setDashboardName] = useState('');
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(['revenueTrend', 'appointmentTrend']);
  const [gridLayout, setGridLayout] = useState<AnalyticsGridItem[]>(() =>
    autoPackGridLayout(['revenueTrend', 'appointmentTrend']),
  );
  const builder = useAnalyticsDashboardBuilder(canCreate);

  useEffect(() => {
    if (builder.savedLayout?.gridLayout?.length) {
      setGridLayout(builder.savedLayout.gridLayout);
      setSelectedWidgets(builder.savedLayout.widgetOrder);
    }
  }, [builder.savedLayout]);

  if (!canCreate) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('analytics.accessDenied')}</AuthAlert>
      </div>
    );
  }

  function toggleWidget(id: string) {
    setSelectedWidgets((prev) => {
      const next = prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id];
      setGridLayout((layout) => autoPackGridLayout(next, layout));
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Link className={styles.backLink} to="/analytics">
            <ArrowLeft size={16} aria-hidden />
            {t('analytics.home.backToHub')}
          </Link>
          <h1 className={styles.title}>{t('analytics.builder.title')}</h1>
          <p className={styles.subtitle}>{t('analytics.builder.subtitle')}</p>
        </div>
      </header>

      <AnalyticsCategoryNav />

      <section className={styles.panel} aria-labelledby="builder-form">
        <h2 id="builder-form" className={styles.panelTitle}>
          {t('analytics.builder.createDashboard')}
        </h2>
        <label className={styles.kpiHint}>
          {t('analytics.builder.dashboardName')}
          <input
            className={styles.chip}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
          />
        </label>

        <div className={styles.domainGrid}>
          {widgetCatalog.map((widget) => (
            <div
              key={widget.id}
              className={styles.domainCard}
              data-selected={selectedWidgets.includes(widget.id) || undefined}
            >
              <span
                className={styles.dragHandleChip}
                aria-label={t('analytics.builder.dragHandle')}
                {...makeWidgetDraggable(widget.id)}
              >
                ⋮⋮
              </span>
              <button
                type="button"
                className={styles.domainCardButton}
                aria-pressed={selectedWidgets.includes(widget.id)}
                onClick={() => toggleWidget(widget.id)}
              >
                <LayoutGrid size={16} aria-hidden />
                <h3 className={styles.domainTitle}>{t(widget.titleKey as 'analytics.title')}</h3>
                <p className={styles.domainDesc}>{t(widget.descriptionKey as 'analytics.subtitle')}</p>
              </button>
            </div>
          ))}
        </div>

        <AnalyticsGridBuilder
          selectedWidgetIds={selectedWidgets}
          layout={gridLayout}
          onLayoutChange={setGridLayout}
        />

        <div className={styles.headerActions}>
          <AuthButton
            loading={builder.saveLayoutMutation.isPending}
            onClick={() =>
              void builder.saveLayoutMutation.mutateAsync({
                widgetOrder: selectedWidgets,
                hiddenWidgets: widgetCatalog.filter((w) => !selectedWidgets.includes(w.id)).map(
                  (w) => w.id,
                ),
                gridLayout,
              })
            }
          >
            <Save size={16} aria-hidden />
            {t('analytics.builder.saveLayout')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            loading={builder.createDashboardMutation.isPending}
            disabled={!dashboardName.trim() || selectedWidgets.length === 0}
            onClick={() =>
              void builder.createDashboardMutation.mutateAsync({
                name: dashboardName.trim(),
                widgets: selectedWidgets.map((id) => {
                  const widget = widgetCatalog.find((w) => w.id === id)!;
                  return {
                    metricName: widget.metricName,
                    title: t(widget.titleKey as 'analytics.title'),
                    chartType: widget.chartType,
                    size: widget.size,
                  };
                }),
              })
            }
          >
            <Plus size={16} aria-hidden />
            {t('analytics.builder.create')}
          </AuthButton>
        </div>

        {builder.success && (
          <p className={styles.kpiHint} role="status">
            {builder.success}
          </p>
        )}
        {builder.error && <AuthAlert variant="error">{builder.error}</AuthAlert>}
      </section>

      {builder.dashboards.length > 0 && (
        <section className={styles.panel} aria-labelledby="saved-dashboards">
          <h2 id="saved-dashboards" className={styles.panelTitle}>
            {t('analytics.builder.savedDashboards')}
          </h2>
          <ul className={styles.list}>
            {builder.dashboards.map((dash) => (
              <li key={dash.dashboardId} className={styles.listItem}>
                <span>{dash.name}</span>
                <span>{dash.widgetCount} widgets</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
