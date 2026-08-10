import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import { useOpsScopes } from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function ScopesPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const query = useOpsScopes(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <AuthAlert variant="error">Failed to load scopes.</AuthAlert>;

  const scopes = query.data?.scopes ?? [];

  return (
    <section className={styles.panel} aria-labelledby="ai-scopes-title">
      <h2 id="ai-scopes-title" className={styles.panelTitle}>
        Scope catalog
      </h2>
      <p className={styles.muted}>
        Deny-by-default catalog. Unknown scopes and <code>*</code> are rejected by the gateway.
      </p>
      {scopes.length === 0 ? (
        <EmptyState title="No scopes visible" detail="Center may be dormant." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Scope id</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.id}</code>
                  </td>
                  <td>{s.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
