import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import { useIntegrationsHealth } from '../hooks/useIntegrationsOps';
import { LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function HealthPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const health = useIntegrationsHealth(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (health.isLoading) return <LoadingBlock />;
  if (health.isError || !health.data) {
    return <AuthAlert variant="error">Failed to load health.</AuthAlert>;
  }

  const d = health.data;
  const flag = d.featureFlag as { name?: string; enabled?: boolean } | undefined;

  return (
    <section className={styles.panel} aria-labelledby="ai-health-title">
      <h2 id="ai-health-title" className={styles.panelTitle}>
        Engine health
      </h2>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{d.ready ? 'ready' : 'not ready'}</p>
          <p className={styles.statLabel}>Hub</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{d.dormant ? 'dormant' : 'active'}</p>
          <p className={styles.statLabel}>Mode</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{String(d.phase)}</p>
          <p className={styles.statLabel}>Phase</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>
            <StatusBadge status={flag?.enabled ? 'on' : 'off'} />
          </p>
          <p className={styles.statLabel}>{flag?.name ?? 'flag'}</p>
        </div>
      </div>
      <dl className={styles.dl}>
        <div className={styles.dlRow}>
          <dt>Credential engine</dt>
          <dd>
            <StatusBadge
              status={
                (d.credentialEngine as { wired?: boolean })?.wired ? 'ready' : 'not ready'
              }
            />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Webhook engine</dt>
          <dd>
            <StatusBadge
              status={
                (d.webhookEngine as { wired?: boolean })?.wired ? 'ready' : 'not ready'
              }
            />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Auth middleware</dt>
          <dd>
            <StatusBadge
              status={
                (d.authMiddleware as { wired?: boolean })?.wired ? 'ready' : 'not ready'
              }
            />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Queue</dt>
          <dd>
            {String((d.queue as { name?: string })?.name)} · wired{' '}
            {String((d.queue as { wired?: boolean })?.wired)}
          </dd>
        </div>
      </dl>
      <details>
        <summary>Raw health payload (no secrets)</summary>
        <pre className={styles.secretBox} style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(d, null, 2)}
        </pre>
      </details>
    </section>
  );
}
