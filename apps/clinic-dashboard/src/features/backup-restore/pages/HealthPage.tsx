import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore } from '../config/backup-restore-config';
import { useBackupRestoreHealth } from '../hooks/useBackupRestore';
import { StatusBadge } from '../components/StatusParts';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

export function HealthPage() {
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);
  const health = useBackupRestoreHealth(canView);

  useEffect(() => {
    logBackupRestoreUiEvent('health_viewed');
  }, []);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view system health.</AuthAlert>;
  }

  const data = health.data;

  return (
    <section className={styles.panel} aria-labelledby="br-health-title">
      <h2 id="br-health-title" className={styles.panelTitle}>
        Engine health
      </h2>
      <p className={styles.muted}>Read-only view of backup-restore health APIs. No direct infrastructure access.</p>
      {health.isLoading ? <p className={styles.muted}>Loading health…</p> : null}
      {health.isError ? <AuthAlert variant="error">Failed to load health.</AuthAlert> : null}
      {data ? (
        <>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{data.ready ? 'ready' : 'not ready'}</p>
              <p className={styles.statLabel}>Hub readiness</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{data.featureFlag.enabled ? 'on' : 'off'}</p>
              <p className={styles.statLabel}>{data.featureFlag.name}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{data.jobEngine.ready ? 'ready' : 'not ready'}</p>
              <p className={styles.statLabel}>Job engine</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{String(data.backupEngine.ready ?? '—')}</p>
              <p className={styles.statLabel}>Backup engine</p>
            </div>
          </div>

          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>Verification engine</dt>
              <dd>
                <StatusBadge status={data.verificationEngine.ready ? 'ready' : 'not ready'} />
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Retention engine</dt>
              <dd>
                <StatusBadge status={data.retentionEngine.ready ? 'ready' : 'not ready'} />
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Restore engine</dt>
              <dd>
                <StatusBadge status={data.restoreEngine.ready ? 'ready' : 'not ready'} />
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Queue</dt>
              <dd>
                {data.queue.name} · wired: {String(data.queue.wired)}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Worker</dt>
              <dd>
                {data.worker.status} · wired: {String(data.worker.wired)}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Scheduler</dt>
              <dd>
                {data.scheduler.status} · wired: {String(data.scheduler.wired)}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Effective view</dt>
              <dd>
                feature={String(data.effectiveView.featureEnabled)} · allowBackupRestore=
                {String(data.effectiveView.allowBackupRestore)} · types={data.effectiveView.types}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Licensing</dt>
              <dd>
                gate={data.licensing.tenantGate} · capabilities: {data.licensing.capabilities.join(', ')}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Phase</dt>
              <dd>{data.phase}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}
