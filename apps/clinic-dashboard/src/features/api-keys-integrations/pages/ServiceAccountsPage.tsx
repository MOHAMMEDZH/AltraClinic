import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { SettingsConfirmDialog } from '@/features/settings/components/SettingsConfirmDialog';
import {
  canCreateApiIntegrations,
  canManageApiIntegrations,
  canViewApiIntegrations,
  formatIso,
} from '../config/api-integrations-config';
import {
  useIntegrationsMutations,
  useServiceAccounts,
} from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function ServiceAccountsPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const query = useServiceAccounts(canView);
  const mutations = useIntegrationsMutations();
  const [name, setName] = useState('');
  const [disableId, setDisableId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;

  return (
    <section className={styles.panel} aria-labelledby="ai-sa-title">
      <h2 id="ai-sa-title" className={styles.panelTitle}>
        Service accounts
      </h2>
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      {query.isError ? (
        <AuthAlert variant="error">
          Failed to load service accounts (flag/license may block).
        </AuthAlert>
      ) : null}

      {canCreateApiIntegrations(roles) ? (
        <div className={styles.formGrid}>
          <label className={styles.label}>
            Display name
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <AuthButton
            type="button"
            loading={mutations.createServiceAccount.isPending}
            disabled={!name.trim()}
            onClick={async () => {
              try {
                await mutations.createServiceAccount.mutateAsync({
                  displayName: name.trim(),
                  roleBindings: [],
                });
                setName('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Create failed');
              }
            }}
          >
            Create service account
          </AuthButton>
        </div>
      ) : null}

      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No service accounts" />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Bindings</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((sa) => (
                <tr key={sa.id}>
                  <td>{sa.displayName}</td>
                  <td>
                    <StatusBadge status={sa.status} />
                  </td>
                  <td>{sa.roleBindings.join(', ') || '—'}</td>
                  <td>{formatIso(sa.createdAt)}</td>
                  <td>
                    {canManageApiIntegrations(roles) && sa.status === 'active' ? (
                      <AuthButton
                        type="button"
                        variant="danger"
                        onClick={() => setDisableId(sa.id)}
                      >
                        Disable
                      </AuthButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SettingsConfirmDialog
        open={Boolean(disableId)}
        title="Disable service account"
        message="Credentials owned by this account will fail authentication."
        destructive
        loading={mutations.disableServiceAccount.isPending}
        onCancel={() => setDisableId(null)}
        onConfirm={async () => {
          if (!disableId) return;
          await mutations.disableServiceAccount.mutateAsync(disableId);
          setDisableId(null);
        }}
      />
    </section>
  );
}
