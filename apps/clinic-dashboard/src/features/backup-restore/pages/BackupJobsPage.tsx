import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateBackup,
  canViewBackupRestore,
  BACKUP_RESTORE_BASE_PATH,
} from '../config/backup-restore-config';
import { useBackupRestoreJobs } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

export function BackupJobsPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewBackupRestore(roles);
  const canCreate = canCreateBackup(roles);
  const jobs = useBackupRestoreJobs({ kind: 'backup', limit: 40 }, canView);

  if (!canView) return <AuthAlert variant="error">Missing backup-restore view permission.</AuthAlert>;

  return (
    <section className={styles.panel} aria-labelledby="br-backups-title">
      <div className={styles.toolbar}>
        <h2 id="br-backups-title" className={styles.panelTitle}>
          Backup jobs
        </h2>
        {canCreate ? (
          <Link to={`${BACKUP_RESTORE_BASE_PATH}/backups/new`}>
            <AuthButton type="button">New backup</AuthButton>
          </Link>
        ) : null}
      </div>
      {(jobs.data ?? []).length === 0 ? (
        <EmptyState title="No backup jobs" detail="Create a backup request to get started." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data ?? []).map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/jobs/${job.id}`}>
                      {job.typeId}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>{job.progress.percent}%</td>
                  <td>{new Date(job.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
