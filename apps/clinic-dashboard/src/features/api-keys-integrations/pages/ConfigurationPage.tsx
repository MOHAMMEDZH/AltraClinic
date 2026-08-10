import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import { useOpsConfiguration } from '../hooks/useIntegrationsOps';
import { LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function ConfigurationPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const query = useOpsConfiguration(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <AuthAlert variant="error">Failed to load configuration.</AuthAlert>;

  const c = query.data ?? {};
  const flags = (c.flags as Record<string, boolean>) ?? {};

  return (
    <section className={styles.panel} aria-labelledby="ai-cfg-title">
      <h2 id="ai-cfg-title" className={styles.panelTitle}>
        Configuration (read-only)
      </h2>
      <p className={styles.muted}>Secret material is never shown — readiness only.</p>
      <dl className={styles.dl}>
        <div className={styles.dlRow}>
          <dt>Feature flag</dt>
          <dd>
            {String(c.featureFlagEnv)} ·{' '}
            <StatusBadge status={c.featureEnabled ? 'on' : 'off'} />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Pepper ready</dt>
          <dd>
            <StatusBadge status={c.pepperReady ? 'ready' : 'not ready'} />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Secret store ready</dt>
          <dd>
            <StatusBadge status={c.secretStoreReady ? 'ready' : 'not ready'} />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Queue</dt>
          <dd>{String(c.queueName)}</dd>
        </div>
      </dl>
      <h3 className={styles.panelTitle}>Sub-flags</h3>
      <ul>
        {Object.entries(flags).map(([k, v]) => (
          <li key={k}>
            <code>{k}</code>: <StatusBadge status={v ? 'on' : 'off'} />
          </li>
        ))}
      </ul>
    </section>
  );
}
