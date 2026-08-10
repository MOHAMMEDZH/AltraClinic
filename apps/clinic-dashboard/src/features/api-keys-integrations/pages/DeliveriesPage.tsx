import { useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManageApiIntegrations,
  canViewApiIntegrations,
  formatIso,
} from '../config/api-integrations-config';
import {
  useIntegrationsMutations,
  useWebhookDeliveries,
} from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function DeliveriesPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const query = useWebhookDeliveries(canView);
  const mutations = useIntegrationsMutations();
  const [filter, setFilter] = useState<'all' | 'failed' | 'dlq'>('all');
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = query.data ?? [];
    if (filter === 'failed') {
      list = list.filter(
        (d) =>
          d.status === 'failed' ||
          d.status.includes('fail') ||
          d.status === 'dead_lettered',
      );
    }
    if (filter === 'dlq') {
      list = list.filter((d) => d.status === 'dead_lettered');
    }
    return list;
  }, [query.data, filter]);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;

  return (
    <section className={styles.panel} aria-labelledby="ai-del-title">
      <h2 id="ai-del-title" className={styles.panelTitle}>
        Delivery history
      </h2>
      <p className={styles.muted}>Failed delivery explorer, DLQ, retry, and replay.</p>
      {message ? (
        <p className={styles.muted} role="status">
          {message}
        </p>
      ) : null}
      {query.isError ? (
        <AuthAlert variant="error">Failed to load deliveries.</AuthAlert>
      ) : null}
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filter deliveries"
        >
          <option value="all">All</option>
          <option value="failed">Failed</option>
          <option value="dlq">Dead letter</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No deliveries" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Id</th>
                <th>Subscription</th>
                <th>Event</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code>{d.id.slice(0, 8)}…</code>
                  </td>
                  <td>
                    <code>{d.subscriptionId.slice(0, 8)}…</code>
                  </td>
                  <td>{d.eventType ?? '—'}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>{formatIso(d.createdAt)}</td>
                  <td>
                    {canManageApiIntegrations(roles) ? (
                      <div className={styles.actions}>
                        <AuthButton
                          type="button"
                          variant="secondary"
                          loading={mutations.retryDelivery.isPending}
                          onClick={async () => {
                            await mutations.retryDelivery.mutateAsync(d.id);
                            setMessage(`Retry queued for ${d.id}`);
                          }}
                        >
                          Retry
                        </AuthButton>
                        <AuthButton
                          type="button"
                          variant="secondary"
                          loading={mutations.replayDelivery.isPending}
                          onClick={async () => {
                            await mutations.replayDelivery.mutateAsync(d.id);
                            setMessage(`Replay queued for ${d.id}`);
                          }}
                        >
                          Replay
                        </AuthButton>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
