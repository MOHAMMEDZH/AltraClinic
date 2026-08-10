import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  canManageApiIntegrations,
  canViewApiIntegrations,
} from '../config/api-integrations-config';
import {
  useGatewayDiagnostics,
  useIntegrationsHealth,
} from '../hooks/useIntegrationsOps';
import { LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function GatewayPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const canManage = canManageApiIntegrations(roles);
  const health = useIntegrationsHealth(canView);
  const gateway = useGatewayDiagnostics(canManage);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ai-gw-title">
        <h2 id="ai-gw-title" className={styles.panelTitle}>
          Gateway diagnostics
        </h2>
        <p className={styles.muted}>
          Authentication / authorization diagnostics. Manage permission required for live gateway probe.
        </p>
        {health.isLoading ? <LoadingBlock /> : null}
        {health.data ? (
          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>Phase</dt>
              <dd>{String(health.data.phase ?? '—')}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Auth middleware</dt>
              <dd>
                <StatusBadge
                  status={
                    (health.data.authMiddleware as { wired?: boolean })?.wired
                      ? 'ready'
                      : 'not ready'
                  }
                />
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Gateway</dt>
              <dd>
                <StatusBadge
                  status={
                    (health.data.gateway as { wired?: boolean })?.wired
                      ? 'ready'
                      : 'not ready'
                  }
                />
              </dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Quota engine</dt>
              <dd>
                <StatusBadge
                  status={
                    (health.data.quotaEngine as { wired?: boolean })?.wired
                      ? 'ready'
                      : 'not ready'
                  }
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {canManage ? (
        <section className={styles.panel} aria-labelledby="ai-gw-live">
          <h2 id="ai-gw-live" className={styles.panelTitle}>
            Live gateway probe
          </h2>
          {gateway.isLoading ? <LoadingBlock /> : null}
          {gateway.isError ? (
            <AuthAlert variant="error">
              Gateway diagnostics unavailable (flag/license may block).
            </AuthAlert>
          ) : null}
          {gateway.data ? (
            <pre className={styles.secretBox} style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(gateway.data, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : (
        <AuthAlert variant="info">
          api.integrations:manage required for live gateway diagnostics.
        </AuthAlert>
      )}
    </div>
  );
}
