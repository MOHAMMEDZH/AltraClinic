import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canSelectQueueBranch } from './config/queue-config';
import { useQueueAnalytics } from './hooks/useQueue';
import { QueueMetrics } from './components/QueueMetrics';
import { QueueExportButton } from './components/QueueWalkInModal';
import { QueueThroughputChart } from './components/charts/QueueThroughputChart';
import styles from './QueueAnalyticsPage.module.css';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QueueAnalyticsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canView = hasPermission(roles, 'api.queue', 'view');
  const canSelectBranch = canSelectQueueBranch(roles);
  const { data: branches = [] } = useDashboardBranches();
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());

  const effectiveBranchId = useMemo(() => {
    if (!canSelectBranch) return user?.branchId ?? undefined;
    return branchFilter;
  }, [branchFilter, canSelectBranch, user?.branchId]);

  const range = useMemo(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59.999`);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [fromDate, toDate]);

  const analyticsQuery = useQueueAnalytics(effectiveBranchId, range.from, range.to);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('queue.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const data = analyticsQuery.data;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link to="/queue" className={styles.back}>
            <ArrowLeft size={16} aria-hidden />
            {t('queue.analytics.back')}
          </Link>
          <h1 className={styles.title}>{t('queue.analytics.title')}</h1>
          <p className={styles.subtitle}>{t('queue.analytics.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <QueueExportButton branchId={effectiveBranchId} />
          <AuthButton variant="secondary" onClick={() => void analyticsQuery.refetch()}>
            <RefreshCw size={16} aria-hidden className={analyticsQuery.isFetching ? styles.spin : ''} />
            {t('queue.refresh')}
          </AuthButton>
        </div>
      </header>

      <div className={styles.filters}>
        {canSelectBranch && branches.length > 0 && (
          <select
            className={styles.select}
            value={branchFilter ?? ''}
            onChange={(e) => setBranchFilter(e.target.value || null)}
            aria-label={t('queue.filter.branch')}
          >
            <option value="">{t('queue.filter.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        <label className={styles.dateField}>
          {t('queue.analytics.from')}
          <input
            type="date"
            className={styles.dateInput}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>

        <label className={styles.dateField}>
          {t('queue.analytics.to')}
          <input
            type="date"
            className={styles.dateInput}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
      </div>

      <QueueMetrics metrics={data?.summary} loading={analyticsQuery.isLoading} managerView />

      <div className={styles.rateGrid}>
        <article className={styles.rateCard}>
          <p className={styles.rateLabel}>{t('queue.analytics.completionRate')}</p>
          <p className={styles.rateValue}>{data?.summary.completionRate ?? 0}%</p>
        </article>
        <article className={styles.rateCard}>
          <p className={styles.rateLabel}>{t('queue.analytics.noShowRate')}</p>
          <p className={styles.rateValue}>{data?.summary.noShowRate ?? 0}%</p>
        </article>
        <article className={styles.rateCard}>
          <p className={styles.rateLabel}>{t('queue.analytics.transferredToday')}</p>
          <p className={styles.rateValue}>{data?.summary.transferredToday ?? 0}</p>
        </article>
      </div>

      <section className={styles.panel} aria-labelledby="queue-throughput-heading">
        <h2 id="queue-throughput-heading" className={styles.panelTitle}>
          {t('queue.analytics.throughput')}
        </h2>
        <QueueThroughputChart data={data?.hourlyThroughput ?? []} />
      </section>

      <section className={styles.panel} aria-labelledby="queue-peak-heading">
        <h2 id="queue-peak-heading" className={styles.panelTitle}>
          {t('queue.analytics.peakHours')}
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('queue.analytics.hour')}</th>
                <th>{t('queue.analytics.totalActivity')}</th>
                <th>{t('queue.analytics.checkIns')}</th>
                <th>{t('queue.metrics.completedToday')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.peakHours ?? []).map((row) => (
                <tr key={row.hour}>
                  <td>{row.hour}</td>
                  <td>{row.totalActivity}</td>
                  <td>{row.checkIns}</td>
                  <td>{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="queue-util-heading">
        <h2 id="queue-util-heading" className={styles.panelTitle}>
          {t('queue.analytics.utilization')}
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('queue.analytics.provider')}</th>
                <th>{t('queue.metrics.waiting')}</th>
                <th>{t('queue.metrics.called')}</th>
                <th>{t('queue.metrics.serving')}</th>
                <th>{t('queue.metrics.completedToday')}</th>
                <th>{t('queue.analytics.utilizationPct')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.providerUtilization ?? []).map((row) => (
                <tr key={row.providerId}>
                  <td>{row.providerName}</td>
                  <td>{row.waiting}</td>
                  <td>{row.called}</td>
                  <td>{row.serving}</td>
                  <td>{row.completedToday}</td>
                  <td>{row.utilizationPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="queue-room-heading">
        <h2 id="queue-room-heading" className={styles.panelTitle}>
          {t('queue.analytics.roomUtilization')}
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('queue.room.label')}</th>
                <th>{t('queue.analytics.activeTickets')}</th>
                <th>{t('queue.metrics.completedToday')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.roomUtilization ?? []).map((row) => (
                <tr key={row.resourceId}>
                  <td>{row.resourceName}</td>
                  <td>{row.activeTickets}</td>
                  <td>{row.completedToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
