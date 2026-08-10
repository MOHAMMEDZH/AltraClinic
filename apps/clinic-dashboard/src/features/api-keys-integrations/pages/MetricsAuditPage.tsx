import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import {
  useIntegrationsOpsDashboard,
  useOpsMetricsCatalog,
} from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function MetricsAuditPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const catalog = useOpsMetricsCatalog(canView);
  const dash = useIntegrationsOpsDashboard(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (catalog.isLoading) return <LoadingBlock />;

  const recent = dash.data?.usage?.recent ?? [];

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ai-metrics-title">
        <h2 id="ai-metrics-title" className={styles.panelTitle}>
          Metrics catalog
        </h2>
        {catalog.isError ? (
          <AuthAlert variant="error">Failed to load metrics catalog.</AuthAlert>
        ) : null}
        <ul>
          {(catalog.data?.metrics ?? []).map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Activity events</h2>
        <ul>
          {(catalog.data?.activityEvents ?? []).map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Audit actions</h2>
        <ul>
          {(catalog.data?.auditActions ?? []).map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.panel} aria-labelledby="ai-timeline-title">
        <h2 id="ai-timeline-title" className={styles.panelTitle}>
          API activity timeline (usage ring)
        </h2>
        {recent.length === 0 ? (
          <EmptyState title="No recent gateway usage events" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Outcome</th>
                  <th>Endpoint</th>
                  <th>Correlation</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, idx) => (
                  <tr key={idx}>
                    <td>{String(e.at ?? '—')}</td>
                    <td>{String(e.outcome ?? '—')}</td>
                    <td>{String(e.endpoint ?? '—')}</td>
                    <td>
                      <code>{String(e.correlationId ?? '—')}</code>
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
