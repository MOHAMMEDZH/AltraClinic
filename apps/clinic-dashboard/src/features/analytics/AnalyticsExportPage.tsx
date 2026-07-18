import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useMemo } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildAnalyticsPermCheck, canExportAnalytics, canViewAnalytics } from './config/analytics-config';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import { useAnalyticsOverview } from './hooks/useAnalyticsOverview';
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters';
import { useAnalyticsReports } from './hooks/useAnalyticsReports';
import { AnalyticsCategoryNav } from './components/AnalyticsCategoryNav';
import { VirtualizedReportsTable, type ReportTableRow } from '@/features/reporting/components/VirtualizedReportsTable';
import { runExport } from '@/lib/run-export';
import { downloadDashboardExcel } from '@/features/dashboard/lib/export-dashboard-excel';
import { downloadDashboardWord } from '@/features/dashboard/lib/export-dashboard-word';
import { downloadDashboardPdf } from '@/features/dashboard/lib/export-dashboard-pdf';
import { downloadDashboardCsv } from '@/features/dashboard/lib/export-dashboard-csv';
import { downloadAnalyticsReport } from './api/analytics-api';
import styles from './analytics-layout.module.css';

export function AnalyticsExportPage() {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useMemo(() => buildAnalyticsPermCheck(roles), [roles]);
  const { isRegistrySource, canViewAnalytics: canViewRegistry, canExportAnalytics: canExportRegistry } =
    useDynamicAnalytics();
  const canView = isRegistrySource ? canViewRegistry : canViewAnalytics(perm);
  const canExport = isRegistrySource ? canExportRegistry : canExportAnalytics(perm);
  const filters = useAnalyticsFilters(roles, user?.branchId);
  const overviewQuery = useAnalyticsOverview(
    filters.branchId,
    filters.range,
    filters.range === 'custom' ? filters.customRange : undefined,
  );
  const reportsQuery = useAnalyticsReports(filters.branchId);

  const reportRows: ReportTableRow[] = useMemo(
    () =>
      (reportsQuery.data ?? []).map((report) => ({
        id: report.reportId,
        name: report.name,
        type: report.reportType,
        format: report.format,
        status: report.status,
        createdAt: report.createdAt,
        canDownload: report.status === 'completed' && canExport,
        detailPath: `/reports/${report.reportId}`,
      })),
    [reportsQuery.data, canExport],
  );

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('analytics.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className={styles.page} id="analytics-export-print-root">
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t('analytics.export.title')}</h1>
          <p className={styles.subtitle}>{t('analytics.export.subtitle')}</p>
        </div>
        <Link className={styles.quickNavLink} to="/reports/export">
          <Download size={16} aria-hidden />
          {t('analytics.export.openCenter')}
        </Link>
      </header>

      <AnalyticsCategoryNav />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('analytics.export.quick')}</h2>
        <div className={styles.headerActions}>
          <AuthButton
            variant="secondary"
            disabled={!overview || !canExport}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardExcel(overview, t('analytics.title'), locale, 'analytics'),
                'Excel export failed',
              )
            }
          >
            <FileSpreadsheet size={16} aria-hidden />
            {t('analytics.exportExcel')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            disabled={!overview || !canExport}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardWord(overview, t('analytics.title'), locale, 'analytics'),
                'Word export failed',
              )
            }
          >
            <FileText size={16} aria-hidden />
            {t('analytics.exportWord')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            disabled={!overview || !canExport}
            onClick={() =>
              overview &&
              void runExport(
                () => downloadDashboardPdf(overview, t('analytics.title'), locale, 'analytics'),
                'PDF export failed',
              )
            }
          >
            <Download size={16} aria-hidden />
            {t('analytics.exportPdf')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            disabled={!overview || !canExport}
            onClick={() =>
              overview && downloadDashboardCsv(overview, 'analytics', locale)
            }
          >
            {t('analytics.exportCsv')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            disabled={!overview || !canExport}
            onClick={() => window.print()}
          >
            <Printer size={16} aria-hidden />
            {t('analytics.export.print')}
          </AuthButton>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('analytics.sections.reports')}</h2>
        {reportRows.length === 0 ? (
          <p className={styles.empty}>{t('analytics.reportsEmpty')}</p>
        ) : (
          <VirtualizedReportsTable
            rows={reportRows}
            onDownload={(row) => {
              void getValidAccessToken().then((token) => {
                if (!token || !user?.tenantId) return;
                const ext = row.format === 'json' ? 'json' : row.format === 'excel' ? 'xlsx' : row.format;
                void downloadAnalyticsReport(token, row.id, `${row.name}.${ext}`, user.tenantId);
              });
            }}
          />
        )}
      </section>
    </div>
  );
}
