import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewImportExport } from '../config/import-export-config';
import { useImportExportHealth } from '../hooks/useImportExport';
import { StatusBadge } from '../components/StatusParts';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

export function HealthPage() {
  const { user } = useAuth();
  const canView = canViewImportExport(user?.roles?.map(String) ?? []);
  const health = useImportExportHealth(canView);

  useEffect(() => {
    logImportExportUiEvent('health_viewed');
  }, []);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission to view system health.</AuthAlert>;
  }

  const data = health.data;

  return (
    <section className={styles.panel} aria-labelledby="health-title">
      <h2 id="health-title" className={styles.panelTitle}>
        System health
      </h2>
      <p className={styles.muted}>Read-only view of hub health APIs. No direct infrastructure access.</p>
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
              <p className={styles.statValue}>{data.queue.connected ? 'connected' : 'offline'}</p>
              <p className={styles.statLabel}>Queue ({data.queue.name})</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{String(data.worker.status ?? '—')}</p>
              <p className={styles.statLabel}>Worker status</p>
            </div>
          </div>

          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>Import runtime</dt>
              <dd>
                <StatusBadge status={data.importRuntime.enabled ? 'enabled' : 'disabled'} />{' '}
                adapters: {(data.importRuntime.attachedAdapters ?? []).join(', ') || 'none'}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Export runtime</dt>
              <dd>
                <StatusBadge status={data.exportRuntime.enabled ? 'enabled' : 'disabled'} />{' '}
                adapters: {(data.exportRuntime.attachedAdapters ?? []).join(', ') || 'none'}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Expiration scheduler</dt>
              <dd>
                {data.expirationScheduler.enabled ? 'enabled' : 'disabled'} · runs{' '}
                {data.expirationScheduler.runs}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Artifact cleanup</dt>
              <dd>
                {data.exportRuntime.artifactCleanup
                  ? `enabled · runs ${data.exportRuntime.artifactCleanup.runs} · expired ${data.exportRuntime.artifactCleanup.lastExpired} · deleted ${data.exportRuntime.artifactCleanup.lastDeleted}`
                  : 'n/a'}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Registry</dt>
              <dd>
                registered {String((data.registry as { registeredTypes?: number }).registeredTypes ?? '—')} ·
                executable {String((data.registry as { executableCount?: number }).executableCount ?? '—')} ·
                attached {String((data.registry as { adapterAttachedCount?: number }).adapterAttachedCount ?? '—')}
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Dormant</dt>
              <dd>{String(data.dormant)}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}
