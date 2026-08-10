import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateBackup,
  canRestore,
  canViewBackupRestore,
  BACKUP_RESTORE_BASE_PATH,
  isCompletedJobStatus,
  isFailedJobStatus,
  isLiveJobStatus,
} from '../config/backup-restore-config';
import {
  useBackupRestoreCatalog,
  useBackupRestoreHealth,
  useBackupRestoreJobs,
} from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

const UPGRADE_CAPABILITIES = [
  { id: 'advancedRestore', label: 'Advanced restore', flag: 'restoreEnabled' },
  { id: 'scheduledBackup', label: 'Scheduled backups', flag: 'schedulerEnabled' },
  { id: 'crossRegionBackup', label: 'Cross-region backup', flag: 'backupCenterEnabled' },
  { id: 'pointInTimeRestore', label: 'Point-in-time restore', flag: 'restoreEnabled' },
] as const;

export function BackupRestoreOverviewPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewBackupRestore(roles);
  const catalog = useBackupRestoreCatalog(canView);
  const health = useBackupRestoreHealth(canView);
  const jobs = useBackupRestoreJobs({ limit: 12 }, canView);

  if (!canView) {
    return <AuthAlert variant="error">You do not have permission to view Backup & Restore Center.</AuthAlert>;
  }

  const allJobs = jobs.data ?? [];
  const running = allJobs.filter((j) => isLiveJobStatus(j.status)).length;
  const failed = allJobs.filter((j) => isFailedJobStatus(j.status)).length;
  const completed = allJobs.filter((j) => isCompletedJobStatus(j.status)).length;
  const catalogView = catalog.data?.catalog;
  const healthData = health.data;

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="br-overview-title">
        <h2 id="br-overview-title" className={styles.panelTitle}>
          Operations overview
        </h2>
        {catalog.isLoading || health.isLoading ? <p className={styles.muted}>Loading…</p> : null}
        {catalog.isError ? <AuthAlert variant="error">Failed to load catalog.</AuthAlert> : null}
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{running}</p>
            <p className={styles.statLabel}>Running / active (sample)</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{failed}</p>
            <p className={styles.statLabel}>Failed / cancelled (sample)</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{completed}</p>
            <p className={styles.statLabel}>Completed (sample)</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{healthData?.ready ? 'ready' : '—'}</p>
            <p className={styles.statLabel}>Engine readiness</p>
          </div>
        </div>
        <div className={styles.actions}>
          {canCreateBackup(roles) ? (
            <Link to={`${BACKUP_RESTORE_BASE_PATH}/backups/new`}>
              <AuthButton type="button">New backup</AuthButton>
            </Link>
          ) : null}
          {canRestore(roles) ? (
            <Link to={`${BACKUP_RESTORE_BASE_PATH}/restores/new`}>
              <AuthButton type="button" variant="secondary">
                New restore
              </AuthButton>
            </Link>
          ) : null}
          <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/health`}>
            System health
          </Link>
        </div>
        {catalogView && !catalogView.featureEnabled ? (
          <AuthAlert variant="warning">
            Backup & Restore Center feature flag is off. The hub is dormant until enabled.
          </AuthAlert>
        ) : null}
        {catalogView && !catalogView.allowBackupRestore ? (
          <AuthAlert variant="warning">
            Licensing denies backup & restore for this tenant (allowBackupRestore).
          </AuthAlert>
        ) : null}
        {healthData ? (
          <div className={styles.statGrid}>
            {UPGRADE_CAPABILITIES.map((cap) => {
              const licensed = healthData.licensing.capabilities.includes(cap.id);
              const flagOn = healthData.flags[cap.flag as keyof typeof healthData.flags];
              if (licensed && flagOn) return null;
              return (
                <div key={cap.id} className={styles.statCard}>
                  <p className={styles.statValue}>{licensed ? 'flag off' : 'upgrade'}</p>
                  <p className={styles.statLabel}>{cap.label}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="br-recent-jobs">
        <h2 id="br-recent-jobs" className={styles.panelTitle}>
          Recent jobs
        </h2>
        {allJobs.length === 0 ? (
          <EmptyState title="No jobs yet" detail="Start a backup or restore request to create work." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => (
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
