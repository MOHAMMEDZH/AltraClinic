import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  useDeleteAnalyticsReport,
  useSavedAnalyticsReports,
  useUpdateAnalyticsReport,
} from '../hooks/useReporting';
import styles from '../reporting-layout.module.css';

export function ScheduledReportsPanel() {
  const { t } = useI18n();
  const reportsQuery = useSavedAnalyticsReports(null, true);
  const updateMutation = useUpdateAnalyticsReport();
  const deleteMutation = useDeleteAnalyticsReport();

  const scheduled = (reportsQuery.data ?? []).filter((r) => r.isScheduled);

  if (scheduled.length === 0) {
    return <p className={styles.empty}>{t('reports.scheduled.empty')}</p>;
  }

  return (
    <ul className={styles.list}>
      {scheduled.map((report) => (
        <li key={report.reportId} className={styles.listItem}>
          <div>
            <strong>{report.name}</strong>
            <span className={styles.hint}>
              {report.scheduleFrequency ?? '—'} · {report.recipientEmails?.length ?? 0} {t('reports.scheduled.recipients')}
            </span>
          </div>
          <div className={styles.headerActions}>
            <AuthButton
              variant="secondary"
              loading={updateMutation.isPending}
              onClick={() => {
                const next = report.scheduleFrequency === 'daily' ? 'weekly' : report.scheduleFrequency === 'weekly' ? 'monthly' : 'daily';
                void updateMutation.mutateAsync({
                  reportId: report.reportId,
                  scheduleFrequency: next,
                });
              }}
            >
              {t('reports.scheduled.cycle')}
            </AuthButton>
            <AuthButton
              variant="secondary"
              loading={updateMutation.isPending}
              onClick={() => {
                void updateMutation.mutateAsync({
                  reportId: report.reportId,
                  isScheduled: false,
                });
              }}
            >
              {t('reports.scheduled.pause')}
            </AuthButton>
            <AuthButton
              variant="secondary"
              loading={deleteMutation.isPending}
              onClick={() => void deleteMutation.mutateAsync(report.reportId)}
            >
              {t('reports.scheduled.delete')}
            </AuthButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
