import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, Share2, Star } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';
import {
  useDownloadAnalyticsReport,
  useDownloadOperationalReport,
  useGenerateAnalyticsReport,
  useRecordReportAudit,
  useReportAudit,
  useReportShares,
  useUnifiedReportDetail,
} from './hooks/useReporting';
import { useReportFavorites } from './hooks/useReportPreferences';
import { ReportAuditPanel } from './components/ReportAuditPanel';
import { ShareReportDialog } from './components/ShareReportDialog';
import type { ReportAuditAction } from './lib/report-audit';
import styles from './reporting-layout.module.css';

function auditActionKey(action: string): ReportAuditAction {
  const normalized = action.replace(/^report\./, '');
  const map: Record<string, ReportAuditAction> = {
    shared: 'shared',
    viewed: 'viewed',
    downloaded: 'downloaded',
    duplicated: 'duplicated',
    created: 'created',
    exported: 'exported',
    scheduled: 'scheduled',
  };
  return map[normalized] ?? 'viewed';
}

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canExportReports: canExport, canCreateReports: canCreate } = useDynamicReporting();

  const detailQuery = useUnifiedReportDetail(reportId, true);
  const sharesQuery = useReportShares(reportId, true);
  const auditQuery = useReportAudit(reportId, true);
  const downloadAnalyticsMutation = useDownloadAnalyticsReport();
  const downloadOperationalMutation = useDownloadOperationalReport();
  const generateMutation = useGenerateAnalyticsReport();
  const auditMutation = useRecordReportAudit();
  const { toggleFavorite, isFavorite } = useReportFavorites();

  const [shareOpen, setShareOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const report = detailQuery.data?.report;
  const reportKind = detailQuery.data?.kind ?? 'analytics';
  const auditEntries = useMemo(
    () =>
      (auditQuery.data ?? []).map((entry) => ({
        id: entry.id,
        reportId: reportId ?? '',
        action: auditActionKey(entry.action),
        userId: entry.actorId,
        userName: entry.actorId,
        createdAt: entry.createdAt,
      })),
    [auditQuery.data, reportId],
  );

  useEffect(() => {
    if (!reportId || !user?.userId) return;
    void auditMutation.mutateAsync({ reportId, action: 'report.viewed' });
  }, [reportId, user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reportId) {
    return (
      <div className={styles.reportingPage}>
        <AuthAlert variant="error">{t('reports.detail.notFound')}</AuthAlert>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <div className={styles.reportingPage} aria-busy="true" />;
  }

  if (!report) {
    return (
      <div className={styles.reportingPage}>
        <AuthAlert variant="error">{t('reports.detail.notFound')}</AuthAlert>
        <Link to="/reports">{t('reports.category.back')}</Link>
      </div>
    );
  }

  const favoriteKey = reportKind === 'analytics' ? `report-${(report as { reportType?: string }).reportType}` : `report-op-${(report as { type?: string }).type}`;

  const reportName = report.name;
  const reportTypeLabel = reportKind === 'analytics'
    ? (report as { reportType: string }).reportType
    : (report as { type: string }).type;
  const reportFormat = report.format;
  const reportStatus = report.status;
  const reportCreatedAt = report.createdAt;
  const reportCompletedAt = report.completedAt;
  const isScheduled = reportKind === 'analytics' ? (report as { isScheduled?: boolean }).isScheduled : false;
  const scheduleFrequency = reportKind === 'analytics' ? (report as { scheduleFrequency?: string }).scheduleFrequency : undefined;
  const reportIdValue = report.reportId;
  const reportDescription = reportKind === 'analytics' ? (report as { description?: string }).description : reportTypeLabel;
  const reportParameters = reportKind === 'analytics' ? (report as { parameters?: Record<string, unknown> }).parameters : undefined;

  return (
    <div className={styles.reportingPage}>
      <Link to="/reports" className={styles.cardAction}>
        <ArrowLeft size={16} aria-hidden /> {t('reports.detail.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{reportName}</h1>
          <p className={styles.subtitle}>{reportDescription ?? reportTypeLabel}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton variant="secondary" onClick={() => toggleFavorite(favoriteKey)} aria-pressed={isFavorite(favoriteKey)}>
            <Star size={16} aria-hidden /> {t('reports.favorites.title')}
          </AuthButton>
          {canCreate && reportKind === 'analytics' && (
            <AuthButton
              variant="secondary"
              loading={generateMutation.isPending}
              onClick={() => {
                void generateMutation.mutateAsync({
                  name: `${reportName} (copy)`,
                  reportType: reportTypeLabel as 'executive',
                  format: reportFormat as 'pdf',
                  parameters: reportParameters,
                  description: typeof reportDescription === 'string' ? reportDescription : undefined,
                }).then((res) => {
                  void auditMutation.mutateAsync({ reportId: res.reportId, action: 'report.duplicated' });
                  setSuccess(t('reports.detail.duplicated'));
                  navigate(`/reports/${res.reportId}`);
                }).catch(() => setError(t('reports.builder.error')));
              }}
            >
              <Copy size={16} aria-hidden /> {t('reports.detail.duplicate')}
            </AuthButton>
          )}
          <AuthButton variant="secondary" onClick={() => setShareOpen(true)}>
            <Share2 size={16} aria-hidden /> {t('reports.detail.share')}
          </AuthButton>
          {canExport && reportStatus === 'completed' && (
            <AuthButton
              loading={downloadAnalyticsMutation.isPending || downloadOperationalMutation.isPending}
              onClick={() => {
                const ext = reportFormat === 'excel' ? 'xlsx' : reportFormat;
                const download = reportKind === 'analytics'
                  ? downloadAnalyticsMutation.mutateAsync({ reportId: reportIdValue, filename: `${reportName}.${ext}` })
                  : downloadOperationalMutation.mutateAsync({ reportId: reportIdValue, filename: `${reportName}.${ext}` });
                void download.then(() => {
                  void auditMutation.mutateAsync({ reportId: reportIdValue, action: 'report.downloaded' });
                }).catch(() => setError(t('reports.export.downloadError')));
              }}
            >
              <Download size={16} aria-hidden /> {t('reports.export.download')}
            </AuthButton>
          )}
        </div>
      </header>

      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('reports.detail.overview')}</h2>
        <dl className={styles.formGrid}>
          <div><dt className={styles.hint}>{t('reports.export.type')}</dt><dd>{reportTypeLabel}</dd></div>
          <div><dt className={styles.hint}>{t('reports.export.format')}</dt><dd>{reportFormat.toUpperCase()}</dd></div>
          <div><dt className={styles.hint}>{t('reports.export.status')}</dt><dd>{reportStatus}</dd></div>
          <div><dt className={styles.hint}>{t('reports.detail.created')}</dt><dd>{new Date(reportCreatedAt).toLocaleString()}</dd></div>
          {reportCompletedAt ? (
            <div>
              <dt className={styles.hint}>{t('reports.detail.completed')}</dt>
              <dd>{new Date(reportCompletedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {isScheduled ? (
            <div>
              <dt className={styles.hint}>{t('reports.scheduled.title')}</dt>
              <dd>{scheduleFrequency ?? '—'}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {(sharesQuery.data ?? []).length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('reports.detail.sharedWith')}</h2>
          <ul className={styles.list}>
            {(sharesQuery.data ?? []).map((share) => (
              <li key={share.id} className={styles.listItem}>
                <span>{share.targetType}: {share.targetId}</span>
                <span className={styles.hint}>{share.access}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('reports.detail.auditTitle')}</h2>
        <ReportAuditPanel entries={auditEntries} />
      </section>

      <ShareReportDialog
        open={shareOpen}
        reportId={reportIdValue}
        reportName={reportName}
        reportKind={reportKind}
        onClose={() => setShareOpen(false)}
        onShared={() => void sharesQuery.refetch()}
      />
    </div>
  );
}
