import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Hammer, Star } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { parseDashboardRangeParam } from '@/features/dashboard/lib/dashboard-drill-down';
import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';
import {
  findReportTemplateInSnapshot,
  snapshotTemplateToReportTemplate,
} from '@/features/dynamic-reporting/lib/report-template-adapter';
import type { ReportTemplate } from './config/reporting-catalog';
import { useReportFavorites, useReportRecents } from './hooks/useReportPreferences';
import { useGenerateAnalyticsReport, useRecentReportActivity } from './hooks/useReporting';
import { RunReportDialog } from './components/RunReportDialog';
import { ReportCategoryNav } from './components/ReportCategoryNav';
import { ReportQuickFilters } from './components/ReportQuickFilters';
import { ReportSearchBar } from './components/ReportSearchBar';
import { ReportTemplateCard } from './components/ReportTemplateCard';
import { ReportAuditPanel } from './components/ReportAuditPanel';
import { ScheduledReportsPanel } from './components/ScheduledReportsPanel';
import styles from './reporting-layout.module.css';

export function ReportingHomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    snapshot,
    canViewReporting: canView,
    canCreateReports: canCreate,
    canExportReports: canExport,
    isLoading,
    source,
    registryStatus,
  } = useDynamicReporting();

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [category, setCategory] = useState(() => searchParams.get('category') ?? 'all');
  const [range, setRange] = useState<DashboardRange>(() =>
    parseDashboardRangeParam(searchParams.get('range')),
  );
  const [runTemplate, setRunTemplate] = useState<ReportTemplate | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { favorites, toggleFavorite, isFavorite } = useReportFavorites();
  const { recents, trackRecent } = useReportRecents();
  const generateMutation = useGenerateAnalyticsReport();

  const categoryOptions = useMemo(
    () => [
      { id: 'all', labelKey: 'reports.categories.all' },
      ...snapshot.categories.map((entry) => ({
        id: entry.categoryId,
        labelKey: entry.labelKey,
      })),
    ],
    [snapshot.categories],
  );

  const visibleTemplates = useMemo(() => {
    const templates = snapshot.templates.map(snapshotTemplateToReportTemplate);
    return templates.filter((template) => {
      if (category !== 'all' && template.categoryId !== category) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const title = t(template.titleKey as 'reports.home.title').toLowerCase();
      const desc = t(template.descriptionKey as 'reports.home.subtitle').toLowerCase();
      return title.includes(q) || desc.includes(q) || template.tags?.some((tag) => tag.includes(q));
    });
  }, [snapshot.templates, category, search, t]);

  const favoriteTemplates = useMemo(
    () =>
      favorites
        .map((id) => findReportTemplateInSnapshot(snapshot, id))
        .filter((template): template is ReportTemplate => Boolean(template)),
    [favorites, snapshot],
  );

  const recentTemplates = useMemo(
    () =>
      recents
        .map((id) => findReportTemplateInSnapshot(snapshot, id))
        .filter((template): template is ReportTemplate => Boolean(template)),
    [recents, snapshot],
  );

  const activityQuery = useRecentReportActivity(canView);
  const recentActivity = useMemo(
    () =>
      (activityQuery.data ?? []).map((entry) => ({
        id: entry.id,
        reportId: entry.reportId,
        action: entry.action as 'viewed',
        userId: entry.actorId,
        userName: entry.actorId,
        createdAt: entry.createdAt,
      })),
    [activityQuery.data],
  );

  function openTemplate(template: ReportTemplate) {
    trackRecent(template.id);
    setError(null);
    if (template.delivery === 'view' && template.route) {
      const sep = template.route.includes('?') ? '&' : '?';
      navigate(`${template.route}${sep}range=${range}`);
      return;
    }
    if (template.delivery === 'export' && template.route) {
      const sep = template.route.includes('?') ? '&' : '?';
      navigate(`${template.route}${sep}range=${range}`);
      return;
    }
    if (template.delivery === 'generate' && canCreate) {
      setRunTemplate(template);
    }
  }

  function actionLabel(template: ReportTemplate): string {
    if (template.delivery === 'view') return t('reports.actions.open');
    if (template.delivery === 'export') return t('reports.actions.export');
    return t('reports.actions.generate');
  }

  if (!canView) {
    return (
      <div
        className={styles.reportingPage}
        id="reports-region"
        aria-busy={isLoading || undefined}
        data-reporting-source={source}
        data-registry-status={registryStatus}
      >
        <AuthAlert variant="error">{t('reports.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div
      className={styles.reportingPage}
      id="reports-region"
      aria-busy={isLoading || undefined}
      data-reporting-source={source}
      data-registry-status={registryStatus}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('reports.home.title')}</h1>
          <p className={styles.subtitle}>{t('reports.home.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          {canCreate && (
            <Link to="/reports/builder">
              <AuthButton variant="secondary"><Hammer size={16} aria-hidden /> {t('reports.home.builder')}</AuthButton>
            </Link>
          )}
          {canExport && (
            <Link to="/reports/export">
              <AuthButton variant="secondary"><Download size={16} aria-hidden /> {t('reports.home.exportCenter')}</AuthButton>
            </Link>
          )}
        </div>
      </header>

      <nav className={styles.quickNav} aria-label={t('reports.home.quickNav')}>
        <Link to="/reports" className={styles.quickNavLink} aria-current="page">{t('reports.home.allReports')}</Link>
        <Link to="/analytics" className={styles.quickNavLink}>{t('reports.home.liveAnalytics')}</Link>
        {canExport && <Link to="/reports/export" className={styles.quickNavLink}>{t('reports.home.exportCenter')}</Link>}
      </nav>

      <ReportCategoryNav activeCategory={category} />

      <ReportQuickFilters range={range} onRangeChange={setRange} />

      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <ReportSearchBar
        value={search}
        onChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categoryOptions}
      />

      {favoriteTemplates.length > 0 && (
        <section className={styles.panel} aria-labelledby="report-favorites">
          <h2 id="report-favorites" className={styles.panelTitle}>
            <Star size={18} aria-hidden /> {t('reports.favorites.title')}
          </h2>
          <div className={styles.grid}>
            {favoriteTemplates.map((template) => (
              <ReportTemplateCard
                key={template.id}
                template={template}
                favorite={isFavorite(template.id)}
                onToggleFavorite={() => toggleFavorite(template.id)}
                to={template.delivery === 'view' || template.delivery === 'export' ? template.route : undefined}
                onOpen={() => openTemplate(template)}
                actionLabel={actionLabel(template)}
              />
            ))}
          </div>
        </section>
      )}

      {recentTemplates.length > 0 && (
        <section className={styles.panel} aria-labelledby="report-recents">
          <h2 id="report-recents" className={styles.panelTitle}>{t('reports.recents.title')}</h2>
          <div className={styles.grid}>
            {recentTemplates.slice(0, 6).map((template) => (
              <ReportTemplateCard
                key={template.id}
                template={template}
                favorite={isFavorite(template.id)}
                onToggleFavorite={() => toggleFavorite(template.id)}
                to={template.delivery === 'view' || template.delivery === 'export' ? template.route : undefined}
                onOpen={() => openTemplate(template)}
                actionLabel={actionLabel(template)}
              />
            ))}
          </div>
        </section>
      )}

      {recentActivity.length > 0 && (
        <section className={styles.panel} aria-labelledby="report-activity">
          <h2 id="report-activity" className={styles.panelTitle}>{t('reports.activity.title')}</h2>
          <ReportAuditPanel entries={recentActivity} />
        </section>
      )}

      {canCreate && (
        <section className={styles.panel} aria-labelledby="report-scheduled">
          <h2 id="report-scheduled" className={styles.panelTitle}>{t('reports.scheduled.title')}</h2>
          <ScheduledReportsPanel />
        </section>
      )}

      <section className={styles.panel} aria-labelledby="report-catalog">
        <h2 id="report-catalog" className={styles.panelTitle}>{t('reports.catalog.title')}</h2>
        {visibleTemplates.length === 0 ? (
          <p className={styles.empty}>{t('reports.catalog.empty')}</p>
        ) : (
          <div className={styles.grid}>
            {visibleTemplates.map((template) => (
              <ReportTemplateCard
                key={template.id}
                template={template}
                favorite={isFavorite(template.id)}
                onToggleFavorite={() => toggleFavorite(template.id)}
                to={template.delivery === 'view' || template.delivery === 'export' ? template.route : undefined}
                onOpen={() => openTemplate(template)}
                actionLabel={actionLabel(template)}
              />
            ))}
          </div>
        )}
      </section>

      <RunReportDialog
        open={Boolean(runTemplate)}
        template={runTemplate}
        loading={generateMutation.isPending}
        onClose={() => setRunTemplate(null)}
        onSubmit={(input) => {
          void generateMutation.mutateAsync({ ...input, parameters: { ...input.parameters, range } }).then(() => {
            setRunTemplate(null);
            setSuccess(t('reports.run.success'));
            if (runTemplate) trackRecent(runTemplate.id);
          }).catch(() => setError(t('reports.run.error')));
        }}
      />
    </div>
  );
}
