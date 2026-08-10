import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManage,
  canViewBackupRestore,
  BACKUP_RESTORE_BASE_PATH,
  isCompletedJobStatus,
  isFailedJobStatus,
  isLiveJobStatus,
} from '../config/backup-restore-config';
import { useBackupRestoreJobs, useBackupRestoreMutations } from '../hooks/useBackupRestore';
import type { BackupRestoreJobKind, BackupRestoreJobStatus } from '../api/backup-restore-api';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

const STATUS_OPTIONS: Array<BackupRestoreJobStatus | 'all' | 'running' | 'completed' | 'failed'> = [
  'all',
  'running',
  'created',
  'queued',
  'validating',
  'waiting',
  'running',
  'paused',
  'cancelling',
  'retrying',
  'completed',
  'failed',
  'cancelled',
  'expired',
  'dead_letter',
];

export function JobsDashboardPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewBackupRestore(roles);
  const canManageJobs = canManage(roles);
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'all';
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<BackupRestoreJobKind | 'all'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const { cancelJob } = useBackupRestoreMutations();

  useEffect(() => {
    logBackupRestoreUiEvent('page_opened', { page: 'jobs' });
  }, []);

  const statusParam = useMemo(() => {
    if (filter === 'running' || filter === 'completed' || filter === 'failed' || filter === 'all') {
      return undefined;
    }
    return filter as BackupRestoreJobStatus;
  }, [filter]);

  const jobsQuery = useBackupRestoreJobs(
    {
      status: statusParam,
      kind: kind === 'all' ? undefined : kind,
      limit: 100,
      offset: 0,
      search,
    },
    canView,
  );

  const rows = useMemo(() => {
    let list = jobsQuery.data ?? [];
    if (filter === 'running') {
      list = list.filter((j) => isLiveJobStatus(j.status));
    } else if (filter === 'completed') {
      list = list.filter((j) => isCompletedJobStatus(j.status));
    } else if (filter === 'failed') {
      list = list.filter((j) => isFailedJobStatus(j.status));
    }
    list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list.slice(page * pageSize, page * pageSize + pageSize);
  }, [jobsQuery.data, filter, page]);

  if (!canView) {
    return <AuthAlert variant="error">Missing api.backupRestore:view permission.</AuthAlert>;
  }

  return (
    <section className={styles.panel} aria-labelledby="br-jobs-title">
      <h2 id="br-jobs-title" className={styles.panelTitle}>
        Job dashboard
      </h2>
      <p className={styles.muted}>Live updates poll while jobs are active or retrying.</p>

      <div className={styles.toolbar} role="search">
        <label className={styles.label}>
          Search
          <input
            className={styles.input}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="id, type, correlation…"
            aria-label="Search jobs"
          />
        </label>
        <label className={styles.label}>
          Filter
          <select
            className={styles.select}
            value={filter}
            onChange={(e) => {
              setParams(e.target.value === 'all' ? {} : { filter: e.target.value });
              setPage(0);
            }}
            aria-label="Filter jobs"
          >
            {[...new Set(STATUS_OPTIONS)].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Kind
          <select
            className={styles.select}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as BackupRestoreJobKind | 'all');
              setPage(0);
            }}
            aria-label="Kind filter"
          >
            <option value="all">all</option>
            <option value="backup">backup</option>
            <option value="restore">restore</option>
            <option value="verification">verification</option>
          </select>
        </label>
      </div>

      {jobsQuery.isLoading ? <p className={styles.muted}>Loading jobs…</p> : null}
      {jobsQuery.isError ? <AuthAlert variant="error">Failed to load jobs.</AuthAlert> : null}

      {rows.length === 0 && !jobsQuery.isLoading ? (
        <EmptyState title="No jobs match" detail="Adjust filters or start a backup/restore request." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Correlation</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/jobs/${job.id}`}>
                      {job.typeId}
                    </Link>
                  </td>
                  <td>{job.kind}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>
                    {job.attemptCount}/{job.maxAttempts}
                  </td>
                  <td>
                    <code>{job.correlationId.slice(0, 8)}…</code>
                  </td>
                  <td>{new Date(job.updatedAt).toLocaleString()}</td>
                  <td>
                    {canManageJobs && isLiveJobStatus(job.status) ? (
                      <AuthButton
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Cancel this job?')) return;
                          logBackupRestoreUiEvent('cancel_requested', { jobId: job.id });
                          cancelJob.mutate(job.id);
                        }}
                      >
                        Cancel
                      </AuthButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.toolbar}>
        <AuthButton type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </AuthButton>
        <span className={styles.muted}>Page {page + 1}</span>
        <AuthButton
          type="button"
          disabled={rows.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </AuthButton>
      </div>
    </section>
  );
}
