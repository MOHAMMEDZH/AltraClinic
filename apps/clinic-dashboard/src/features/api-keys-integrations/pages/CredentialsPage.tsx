import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { SettingsConfirmDialog } from '@/features/settings/components/SettingsConfirmDialog';
import {
  API_INTEGRATIONS_BASE_PATH,
  canCreateApiIntegrations,
  canDeleteApiIntegrations,
  canManageApiIntegrations,
  canViewApiIntegrations,
  formatIso,
} from '../config/api-integrations-config';
import {
  useCredentials,
  useIntegrationsMutations,
} from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function CredentialsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const query = useCredentials(canView);
  const mutations = useIntegrationsMutations();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [expireOpen, setExpireOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = query.data ?? [];
    if (status !== 'all') list = list.filter((c) => c.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.prefix.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.scopes.some((s) => s.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [query.data, search, status]);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) {
    return (
      <AuthAlert variant="error">
        {t('apiIntegrations.errors.credentials', 'Failed to load credentials. Center may be dormant.')}
      </AuthAlert>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="ai-cred-title">
      <h2 id="ai-cred-title" className={styles.panelTitle}>
        {t('apiIntegrations.credentials.title', 'API credentials')}
      </h2>
      {message ? (
        <p className={styles.muted} role="status">
          {message}
        </p>
      ) : null}
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('apiIntegrations.credentials.search', 'Search name, prefix, scope…')}
          aria-label="Search credentials"
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
        >
          <option value="all">All statuses</option>
          <option value="active">active</option>
          <option value="expiring">expiring</option>
          <option value="rotated">rotated</option>
          <option value="revoked">revoked</option>
          <option value="expired">expired</option>
        </select>
        {canCreateApiIntegrations(roles) ? (
          <Link to={`${API_INTEGRATIONS_BASE_PATH}/credentials/new`}>
            <AuthButton type="button">New credential</AuthButton>
          </Link>
        ) : null}
        {canManageApiIntegrations(roles) ? (
          <AuthButton type="button" variant="secondary" onClick={() => setExpireOpen(true)}>
            Run expire ops
          </AuthButton>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No credentials"
          detail="Issue a credential when the center flag and license allow it."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className={styles.linkBtn} to={`${API_INTEGRATIONS_BASE_PATH}/credentials/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <code>{c.prefix}</code>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.scopes.join(', ')}</td>
                  <td>{formatIso(c.lastUsedAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      {canDeleteApiIntegrations(roles) &&
                      c.status !== 'revoked' &&
                      c.status !== 'expired' ? (
                        <AuthButton
                          type="button"
                          variant="danger"
                          onClick={() => setRevokeId(c.id)}
                        >
                          Revoke
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

      <SettingsConfirmDialog
        open={Boolean(revokeId)}
        title="Revoke credential"
        message="This permanently revokes the API key. Clients using it will fail closed."
        destructive
        loading={mutations.revokeCredential.isPending}
        onCancel={() => setRevokeId(null)}
        onConfirm={async () => {
          if (!revokeId) return;
          await mutations.revokeCredential.mutateAsync({ id: revokeId });
          setRevokeId(null);
          setMessage('Credential revoked.');
        }}
      />
      <SettingsConfirmDialog
        open={expireOpen}
        title="Expire credentials"
        message="Runs expire/grace finalization for rotated and expired credentials."
        loading={mutations.expireCredentials.isPending}
        onCancel={() => setExpireOpen(false)}
        onConfirm={async () => {
          const res = await mutations.expireCredentials.mutateAsync();
          setExpireOpen(false);
          setMessage(`Expire ops: expired=${res.expired}, graceRevoked=${res.graceRevoked}`);
        }}
      />
    </section>
  );
}
