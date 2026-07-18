import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateImport,
  canExportData,
  canViewImportExport,
  IMPORT_EXPORT_BASE_PATH,
} from '../config/import-export-config';
import { useImportExportCatalog, useImportExportHealth, useImportExportJobs } from '../hooks/useImportExport';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../import-export-layout.module.css';

export function ImportExportOverviewPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewImportExport(roles);
  const catalog = useImportExportCatalog(canView);
  const health = useImportExportHealth(canView);
  const jobs = useImportExportJobs({ limit: 8 }, canView);

  if (!canView) {
    return <AuthAlert variant="error">You do not have permission to view Import / Export Center.</AuthAlert>;
  }

  const running = (jobs.data ?? []).filter((j) =>
    ['queued', 'running', 'retrying'].includes(j.status),
  ).length;
  const failed = (jobs.data ?? []).filter((j) =>
    ['failed', 'dead_letter'].includes(j.status),
  ).length;

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ie-overview-title">
        <h2 id="ie-overview-title" className={styles.panelTitle}>
          Operations overview
        </h2>
        {catalog.isLoading || health.isLoading ? <p className={styles.muted}>Loading…</p> : null}
        {catalog.isError ? <AuthAlert variant="error">Failed to load catalog.</AuthAlert> : null}
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{catalog.data?.meta.visibleCount ?? '—'}</p>
            <p className={styles.statLabel}>Visible catalog types</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{catalog.data?.meta.executableCount ?? '—'}</p>
            <p className={styles.statLabel}>Executable adapters</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{running}</p>
            <p className={styles.statLabel}>Active jobs (sample)</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{failed}</p>
            <p className={styles.statLabel}>Failed / DLQ (sample)</p>
          </div>
        </div>
        <div className={styles.actions}>
          {canCreateImport(roles) ? (
            <Link to={`${IMPORT_EXPORT_BASE_PATH}/imports/new`}>
              <AuthButton type="button">Start import</AuthButton>
            </Link>
          ) : null}
          {canExportData(roles) && catalog.data?.allowDataExport ? (
            <Link to={`${IMPORT_EXPORT_BASE_PATH}/exports/new`}>
              <AuthButton type="button" variant="secondary">
                Start export
              </AuthButton>
            </Link>
          ) : null}
          <Link className={styles.linkBtn} to={`${IMPORT_EXPORT_BASE_PATH}/health`}>
            System health
          </Link>
        </div>
        {catalog.data && !catalog.data.featureEnabled ? (
          <AuthAlert variant="warning">
            Import/Export Center feature flag is off. The hub is dormant until enabled.
          </AuthAlert>
        ) : null}
        {catalog.data && !catalog.data.allowDataImport && !catalog.data.allowDataExport ? (
          <AuthAlert variant="warning">Licensing denies both data import and export for this tenant.</AuthAlert>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="ie-recent-jobs">
        <h2 id="ie-recent-jobs" className={styles.panelTitle}>
          Recent jobs
        </h2>
        {(jobs.data ?? []).length === 0 ? (
          <EmptyState title="No jobs yet" detail="Start an import or export wizard to create work." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).map((job) => (
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
                    <td>{new Date(job.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
