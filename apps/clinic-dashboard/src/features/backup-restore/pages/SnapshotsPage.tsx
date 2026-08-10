import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore, formatBytes } from '../config/backup-restore-config';
import { useSnapshots } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

export function SnapshotsPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const snapshots = useSnapshots(canView);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view snapshots.</AuthAlert>;
  }

  const rows = snapshots.data ?? [];

  return (
    <section className={styles.panel} aria-labelledby="br-snapshots-title">
      <h2 id="br-snapshots-title" className={styles.panelTitle}>
        Snapshots
      </h2>
      <p className={styles.muted}>Read-only snapshot metadata. No download or restore from this table.</p>
      {snapshots.isLoading ? <p className={styles.muted}>Loading snapshots…</p> : null}
      {snapshots.isError ? <AuthAlert variant="error">Failed to load snapshots.</AuthAlert> : null}
      {rows.length === 0 && !snapshots.isLoading ? (
        <EmptyState title="No snapshots" detail="Snapshots appear after successful backup jobs." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Size</th>
                <th>Compression</th>
                <th>Encryption</th>
                <th>Verification</th>
                <th>Created</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.id.slice(0, 12)}…</code>
                  </td>
                  <td>{s.manifest.typeId}</td>
                  <td>{s.sizeBytes != null ? formatBytes(s.sizeBytes) : '—'}</td>
                  <td>{s.compression}</td>
                  <td>{s.encryptionClass}</td>
                  <td>
                    <StatusBadge status={s.verificationStatus} />
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
