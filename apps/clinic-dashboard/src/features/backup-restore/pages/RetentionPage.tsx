import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore, formatBytes } from '../config/backup-restore-config';
import { useRetention } from '../hooks/useBackupRestore';
import { EmptyState, StatusBadge } from '../components/StatusParts';
import styles from '../backup-restore-layout.module.css';

export function RetentionPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const retention = useRetention(canView);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view retention data.</AuthAlert>;
  }

  const evaluations = retention.data?.evaluations ?? [];
  const cleanupPlans = retention.data?.cleanupPlans ?? [];

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="br-retention-eval-title">
        <h2 id="br-retention-eval-title" className={styles.panelTitle}>
          Retention evaluations
        </h2>
        <p className={styles.muted}>Policy evaluations are read-only. No execute actions in the UI.</p>
        {retention.isLoading ? <p className={styles.muted}>Loading retention…</p> : null}
        {retention.isError ? <AuthAlert variant="error">Failed to load retention data.</AuthAlert> : null}
        {evaluations.length === 0 && !retention.isLoading ? (
          <EmptyState title="No evaluations" detail="Evaluations appear when retention engine runs." />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Evaluated</th>
                  <th>Expired</th>
                  <th>Retained</th>
                  <th>Legal hold</th>
                  <th>Correlation</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.evaluatedAt).toLocaleString()}</td>
                    <td>{e.expiredSnapshotIds.length}</td>
                    <td>{e.retainedSnapshotIds.length}</td>
                    <td>{e.legalHoldSnapshotIds.length}</td>
                    <td>
                      <code>{e.correlationId.slice(0, 8)}…</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="br-cleanup-plans-title">
        <h2 id="br-cleanup-plans-title" className={styles.panelTitle}>
          Cleanup plans
        </h2>
        <p className={styles.muted}>
          Plans are displayed for transparency. Cleanup execution is not wired in Phase 43f.
        </p>
        {cleanupPlans.length === 0 && !retention.isLoading ? (
          <EmptyState title="No cleanup plans" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Priority</th>
                  <th>Items</th>
                  <th>Reclaimable</th>
                  <th>Executed</th>
                </tr>
              </thead>
              <tbody>
                {cleanupPlans.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>{p.priority}</td>
                    <td>{p.itemCount}</td>
                    <td>{formatBytes(p.estimatedReclaimedBytes)}</td>
                    <td>
                      <StatusBadge status={p.executed ? 'executed' : 'planned'} />
                    </td>
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
