import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { useSchedulingProviders } from '@/features/scheduling/hooks/useScheduling';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { canSelectQueueBranch } from './config/queue-config';
import { useQueueHistory } from './hooks/useQueue';
import styles from './QueueHistoryPage.module.css';

const PAGE_SIZE = 25;

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHistoryStatus(status: string | null, t: (key: string) => string): string {
  if (!status) return '—';
  const key = `queue.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function QueueHistoryPage() {
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canView = hasPermission(roles, 'api.queue', 'view');
  const canSelectBranch = canSelectQueueBranch(roles);
  const { data: branches = [] } = useDashboardBranches();

  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());
  const [page, setPage] = useState(1);

  const effectiveBranchId = useMemo(() => {
    if (!canSelectBranch) return user?.branchId ?? undefined;
    return branchFilter;
  }, [branchFilter, canSelectBranch, user?.branchId]);

  const providersQuery = useSchedulingProviders(effectiveBranchId ?? undefined);
  const providers = providersQuery.data?.items ?? [];

  const range = useMemo(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59.999`);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [fromDate, toDate]);

  const historyQuery = useQueueHistory({
    branchId: effectiveBranchId,
    providerId: providerFilter || undefined,
    from: range.from,
    to: range.to,
    page,
    pageSize: PAGE_SIZE,
    enabled: canView,
  });

  const total = historyQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = historyQuery.data?.items ?? [];
  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('queue.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link to="/queue" className={styles.back}>
            <ArrowLeft size={16} aria-hidden />
            {t('queue.history.back')}
          </Link>
          <h1 className={styles.title}>{t('queue.history.title')}</h1>
          <p className={styles.subtitle}>{t('queue.history.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={() => void historyQuery.refetch()}>
            <RefreshCw size={16} aria-hidden className={historyQuery.isFetching ? styles.spin : ''} />
            {t('queue.refresh')}
          </AuthButton>
        </div>
      </header>

      <div className={styles.filters}>
        {canSelectBranch && branches.length > 0 && (
          <select
            className={styles.select}
            value={branchFilter ?? ''}
            onChange={(e) => {
              setBranchFilter(e.target.value || null);
              setPage(1);
            }}
            aria-label={t('queue.filter.branch')}
          >
            <option value="">{t('queue.filter.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        {providers.length > 0 && (
          <select
            className={styles.select}
            value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('queue.filter.provider')}
          >
            <option value="">{t('queue.filter.allProviders')}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <label className={styles.dateField}>
          {t('queue.history.from')}
          <input
            type="date"
            className={styles.dateInput}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </label>

        <label className={styles.dateField}>
          {t('queue.history.to')}
          <input
            type="date"
            className={styles.dateInput}
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <section className={styles.panel} aria-labelledby="queue-history-heading">
        <h2 id="queue-history-heading" className={styles.srOnly}>{t('queue.history.title')}</h2>

        {historyQuery.isLoading && items.length === 0 ? (
          <p aria-busy="true">{t('auth.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={t('queue.history.emptyTitle')}
            description={t('queue.history.emptyDescription')}
          />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('queue.history.time')}</th>
                    <th>{t('queue.history.patient')}</th>
                    <th>{t('queue.history.action')}</th>
                    <th>{t('queue.history.fromStatus')}</th>
                    <th>{t('queue.history.toStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.eventId}>
                      <td>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(row.createdAt))}
                      </td>
                      <td>
                        <Link to={`/patients/${row.patientId}`} className={styles.patientLink}>
                          {row.patientName}
                        </Link>
                      </td>
                      <td>{row.action}</td>
                      <td>{formatHistoryStatus(row.fromStatus, t)}</td>
                      <td>{formatHistoryStatus(row.toStatus, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className={styles.pagination}>
              <span className={styles.pageInfo}>
                {formatMessage(t('queue.history.pageInfo'), {
                  start: String(total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1),
                  end: String(Math.min(page * PAGE_SIZE, total)),
                  total: String(total),
                })}
              </span>
              {totalPages > 1 && (
                <div className={styles.pageActions}>
                  <AuthButton
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <PrevIcon size={16} aria-hidden />
                    {t('queue.history.prev')}
                  </AuthButton>
                  <span className={styles.pageInfo}>
                    {formatMessage(t('queue.history.page'), {
                      page: String(page),
                      total: String(totalPages),
                    })}
                  </span>
                  <AuthButton
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('queue.history.next')}
                    <NextIcon size={16} aria-hidden />
                  </AuthButton>
                </div>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
