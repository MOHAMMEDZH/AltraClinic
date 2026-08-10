import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore } from '../config/backup-restore-config';
import { useVerificationResults } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

export function VerificationPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const verification = useVerificationResults(canView);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view verification history.</AuthAlert>;
  }

  const rows = verification.data ?? [];

  return (
    <section className={styles.panel} aria-labelledby="br-verification-title">
      <h2 id="br-verification-title" className={styles.panelTitle}>
        Verification history
      </h2>
      <p className={styles.muted}>Checksum and manifest validation results from the verification engine.</p>
      {verification.isLoading ? <p className={styles.muted}>Loading verification results…</p> : null}
      {verification.isError ? <AuthAlert variant="error">Failed to load verification results.</AuthAlert> : null}
      {rows.length === 0 && !verification.isLoading ? (
        <EmptyState title="No verification results" detail="Results appear after backup verification runs." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Status</th>
                <th>Stages</th>
                <th>Failure</th>
                <th>Correlation</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.snapshotId.slice(0, 12)}…</code>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.stagesCompleted.length}</td>
                  <td>{r.failureReason ?? '—'}</td>
                  <td>
                    <code>{r.correlationId.slice(0, 8)}…</code>
                  </td>
                  <td>{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
