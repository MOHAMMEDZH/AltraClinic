import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { parseDashboardRangeParam } from '@/features/dashboard/lib/dashboard-drill-down';
import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';
import { snapshotTemplateToReportTemplate } from '@/features/dynamic-reporting/lib/report-template-adapter';
import type { ReportCategoryId, ReportTemplate } from './config/reporting-catalog';
import { parseReportCategoryParam } from './lib/reporting-url';
import { useReportFavorites, useReportRecents } from './hooks/useReportPreferences';
import { useGenerateAnalyticsReport } from './hooks/useReporting';
import { ReportCategoryNav } from './components/ReportCategoryNav';
import { ReportQuickFilters } from './components/ReportQuickFilters';
import { ReportSearchBar } from './components/ReportSearchBar';
import { ReportTemplateCard } from './components/ReportTemplateCard';
import { RunReportDialog } from './components/RunReportDialog';
import styles from './reporting-layout.module.css';

export function ReportCategoryPage() {
  const { categoryId: rawCategory } = useParams<{ categoryId: string }>();
  const categoryId = parseReportCategoryParam(rawCategory) as ReportCategoryId | null;
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    templatesByCategory,
    canViewReporting: canView,
    canCreateReports: canCreate,
  } = useDynamicReporting();

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DashboardRange>(() => parseDashboardRangeParam('30d'));
  const [runTemplate, setRunTemplate] = useState<ReportTemplate | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { toggleFavorite, isFavorite } = useReportFavorites();
  const { trackRecent } = useReportRecents();
  const generateMutation = useGenerateAnalyticsReport();

  const templates = useMemo(() => {
    if (!categoryId) return [];
    const categoryTemplates = templatesByCategory[categoryId] ?? [];
    return categoryTemplates.map(snapshotTemplateToReportTemplate).filter((template) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const title = t(template.titleKey as 'reports.home.title').toLowerCase();
      const desc = t(template.descriptionKey as 'reports.home.subtitle').toLowerCase();
      return title.includes(q) || desc.includes(q) || template.tags?.some((tag) => tag.includes(q));
    });
  }, [categoryId, templatesByCategory, search, t]);

  function openTemplate(template: ReportTemplate) {
    trackRecent(template.id);
    setError(null);
    if ((template.delivery === 'view' || template.delivery === 'export') && template.route) {
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
      <div className={styles.reportingPage} id="reports-region">
        <AuthAlert variant="error">{t('reports.accessDenied')}</AuthAlert>
      </div>
    );
  }

  if (!categoryId) {
    return (
      <div className={styles.reportingPage} id="reports-region">
        <AuthAlert variant="error">{t('reports.category.notFound')}</AuthAlert>
        <Link to="/reports">{t('reports.category.back')}</Link>
      </div>
    );
  }

  return (
    <div className={styles.reportingPage} id="reports-region">
      <Link to="/reports" className={styles.cardAction}>
        <ArrowLeft size={16} aria-hidden /> {t('reports.category.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t(`reports.categories.${categoryId}` as 'reports.categories.all')}</h1>
          <p className={styles.subtitle}>{t('reports.category.subtitle')}</p>
        </div>
      </header>

      <ReportCategoryNav activeCategory={categoryId} />

      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <ReportQuickFilters range={range} onRangeChange={setRange} />

      <ReportSearchBar
        value={search}
        onChange={setSearch}
        category={categoryId}
        onCategoryChange={() => {}}
        categories={[]}
        showCategorySelect={false}
      />

      <section className={styles.panel} aria-labelledby="category-catalog">
        <h2 id="category-catalog" className={styles.panelTitle}>{t('reports.catalog.title')}</h2>
        {templates.length === 0 ? (
          <p className={styles.empty}>{t('reports.catalog.empty')}</p>
        ) : (
          <div className={styles.grid}>
            {templates.map((template) => (
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
