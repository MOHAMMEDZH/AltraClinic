import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManageImportExport,
  canViewImportExport,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import { useImportExportJobs, useImportExportMutations } from '../hooks/useImportExport';
import type { JobDirection, JobStatus } from '../api/import-export-api';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

const STATUS_OPTIONS: Array<JobStatus | 'all' | 'running' | 'completed' | 'failed'> = [
  'all',
  'running',
  'queued',
  'running',
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
  const canView = canViewImportExport(roles);
  const canManage = canManageImportExport(roles);
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? 'all';
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<JobDirection | 'all'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const { cancelJob, retryJob } = useImportExportMutations();

  useEffect(() => {
    logImportExportUiEvent('page_opened', { page: 'jobs' });
  }, []);

  const statusParam = useMemo(() => {
    if (filter === 'running') return undefined;
    if (filter === 'completed') return 'completed' as JobStatus;
    if (filter === 'failed') return 'failed' as JobStatus;
    if (filter === 'all') return undefined;
    return filter as JobStatus;
  }, [filter]);

  const jobsQuery = useImportExportJobs(
    {
      status: statusParam,
      direction: direction === 'all' ? undefined : direction,
      limit: 100,
      offset: 0,
      search,
    },
    canView,
  );

  const rows = useMemo(() => {
    let list = jobsQuery.data ?? [];
    if (filter === 'running') {
      list = list.filter((j) => ['queued', 'running', 'retrying', 'draft'].includes(j.status));
    } else if (filter === 'completed') {
      list = list.filter((j) => ['completed', 'completed_with_warnings'].includes(j.status));
    } else if (filter === 'failed') {
      list = list.filter((j) => ['failed', 'dead_letter', 'expired', 'cancelled'].includes(j.status));
    }
    list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list.slice(page * pageSize, page * pageSize + pageSize);
  }, [jobsQuery.data, filter, page]);

  if (!canView) {
    return <AuthAlert variant="error">Missing api.importExport:view permission.</AuthAlert>;
  }

  return (
    <section className={styles.panel} aria-labelledby="jobs-title">
      <h2 id="jobs-title" className={styles.panelTitle}>
        Job dashboard
      </h2>
      <p className={styles.muted}>Live updates poll while jobs are queued, running, or retrying.</p>

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
          Direction
          <select
            className={styles.select}
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as JobDirection | 'all');
              setPage(0);
            }}
            aria-label="Direction filter"
          >
            <option value="all">all</option>
            <option value="import">import</option>
            <option value="export">export</option>
          </select>
        </label>
      </div>

      {jobsQuery.isLoading ? <p className={styles.muted}>Loading jobs…</p> : null}
      {jobsQuery.isError ? <AuthAlert variant="error">Failed to load jobs.</AuthAlert> : null}

      {rows.length === 0 && !jobsQuery.isLoading ? (
        <EmptyState title="No jobs match" detail="Adjust filters or start a wizard." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Direction</th>
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
                    <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/jobs/${job.id}`}>
                      {job.typeId}
                    </Link>
                  </td>
                  <td>{job.direction}</td>
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
                    <div className={styles.actions}>
                      {canManage && ['queued', 'running', 'retrying', 'draft'].includes(job.status) ? (
                        <AuthButton
                          type="button"
                          onClick={() => {
                            if (!window.confirm('Cancel this job?')) return;
                            logImportExportUiEvent('cancel_requested', { jobId: job.id });
                            cancelJob.mutate(job.id);
                          }}
                        >
                          Cancel
                        </AuthButton>
                      ) : null}
                      {canManage && (job.status === 'failed' || job.status === 'dead_letter') ? (
                        <AuthButton
                          type="button"
                          onClick={() => {
                            logImportExportUiEvent('retry_requested', { jobId: job.id });
                            retryJob.mutate(job.id);
                          }}
                        >
                          Retry
                        </AuthButton>
                      ) : null}
                    </div>
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
