import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore, formatBytes, BACKUP_RESTORE_BASE_PATH } from '../config/backup-restore-config';
import { useRecoveryPoints } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

export function RecoveryPointsPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const recoveryPoints = useRecoveryPoints(canView);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view recovery points.</AuthAlert>;
  }

  const rows = recoveryPoints.data ?? [];

  return (
    <section className={styles.panel} aria-labelledby="br-recovery-points-title">
      <h2 id="br-recovery-points-title" className={styles.panelTitle}>
        Recovery points
      </h2>
      <p className={styles.muted}>
        Verified recovery points eligible for restore. Use the restore wizard for drill or controlled restore.
      </p>
      {recoveryPoints.isLoading ? <p className={styles.muted}>Loading recovery points…</p> : null}
      {recoveryPoints.isError ? <AuthAlert variant="error">Failed to load recovery points.</AuthAlert> : null}
      {rows.length === 0 && !recoveryPoints.isLoading ? (
        <EmptyState title="No recovery points" detail="Points appear after verified backups." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Snapshot</th>
                <th>Verified</th>
                <th>Restore available</th>
                <th>Size</th>
                <th>Captured</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rp) => (
                <tr key={rp.id}>
                  <td>{rp.label ?? rp.id.slice(0, 12)}</td>
                  <td>{rp.typeId}</td>
                  <td>
                    <code>{rp.snapshotId.slice(0, 12)}…</code>
                  </td>
                  <td>
                    <StatusBadge status={rp.verified ? 'verified' : rp.verificationStatus} />
                  </td>
                  <td>
                    <StatusBadge status={rp.restoreAvailable ? 'available' : 'unavailable'} />
                  </td>
                  <td>{rp.sizeBytes != null ? formatBytes(rp.sizeBytes) : '—'}</td>
                  <td>{new Date(rp.capturedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link className={styles.linkBtn} to={`${BACKUP_RESTORE_BASE_PATH}/restores/new`}>
        Start restore from recovery point →
      </Link>
    </section>
  );
}
