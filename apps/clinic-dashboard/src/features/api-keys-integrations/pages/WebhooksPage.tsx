import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { SettingsConfirmDialog } from '@/features/settings/components/SettingsConfirmDialog';
import {
  canCreateApiIntegrations,
  canDeleteApiIntegrations,
  canManageApiIntegrations,
  canUpdateApiIntegrations,
  canViewApiIntegrations,
  formatIso,
} from '../config/api-integrations-config';
import {
  useIntegrationsMutations,
  useWebhookSubscriptions,
} from '../hooks/useIntegrationsOps';
import { SecretRevealDialog } from '../components/SecretRevealDialog';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function WebhooksPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const query = useWebhookSubscriptions(canView);
  const mutations = useIntegrationsMutations();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('credential.created,credential.revoked');
  const [reveal, setReveal] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;

  return (
    <section className={styles.panel} aria-labelledby="ai-wh-title">
      <h2 id="ai-wh-title" className={styles.panelTitle}>
        Webhook subscriptions
      </h2>
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      {query.isError ? (
        <AuthAlert variant="error">Failed to load subscriptions.</AuthAlert>
      ) : null}

      {canCreateApiIntegrations(roles) ? (
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.label}>
            Target URL (HTTPS)
            <input className={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className={styles.label}>
            Event filters (comma-separated)
            <input
              className={styles.input}
              value={events}
              onChange={(e) => setEvents(e.target.value)}
            />
          </label>
          <AuthButton
            type="button"
            loading={mutations.createSubscription.isPending}
            disabled={!name.trim() || !url.trim()}
            onClick={async () => {
              try {
                const res = await mutations.createSubscription.mutateAsync({
                  name: name.trim(),
                  targetUrl: url.trim(),
                  eventFilters: events
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                setReveal(res.secret ?? null);
                setName('');
                setUrl('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Create failed');
              }
            }}
          >
            Create subscription
          </AuthButton>
        </div>
      ) : null}

      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No webhook subscriptions" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Status</th>
                <th>Events</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <code>{s.targetUrl ?? s.url}</code>
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{(s.eventFilters ?? s.events ?? []).join(', ')}</td>
                  <td>{formatIso(s.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      {canUpdateApiIntegrations(roles) && s.status !== 'active' ? (
                        <AuthButton
                          type="button"
                          variant="secondary"
                          onClick={() => mutations.enableSubscription.mutate(s.id)}
                        >
                          Enable
                        </AuthButton>
                      ) : null}
                      {canUpdateApiIntegrations(roles) && s.status === 'active' ? (
                        <AuthButton
                          type="button"
                          variant="secondary"
                          onClick={() => mutations.disableSubscription.mutate(s.id)}
                        >
                          Disable
                        </AuthButton>
                      ) : null}
                      {canManageApiIntegrations(roles) ? (
                        <AuthButton
                          type="button"
                          onClick={async () => {
                            const res = await mutations.rotateSecret.mutateAsync(s.id);
                            setReveal(res.secret ?? null);
                          }}
                        >
                          Rotate secret
                        </AuthButton>
                      ) : null}
                      {canDeleteApiIntegrations(roles) ? (
                        <AuthButton
                          type="button"
                          variant="danger"
                          onClick={() => setDeleteId(s.id)}
                        >
                          Delete
                        </AuthButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SecretRevealDialog
        open={Boolean(reveal)}
        title="Webhook signing secret (one-time)"
        secret={reveal}
        onClose={() => setReveal(null)}
      />
      <SettingsConfirmDialog
        open={Boolean(deleteId)}
        title="Delete subscription"
        message="Removes the subscription and stops outbound delivery."
        destructive
        loading={mutations.deleteSubscription.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await mutations.deleteSubscription.mutateAsync(deleteId);
          setDeleteId(null);
        }}
      />
    </section>
  );
}
