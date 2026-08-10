import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import { useOpsProviders } from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function ProvidersPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const query = useOpsProviders(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <AuthAlert variant="error">Failed to load providers.</AuthAlert>;

  const runtime = query.data?.runtime ?? [];
  const catalog = query.data?.staticCatalog ?? [];

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ai-providers-runtime">
        <h2 id="ai-providers-runtime" className={styles.panelTitle}>
          Runtime providers
        </h2>
        {runtime.length === 0 ? (
          <EmptyState title="No runtime providers registered" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Name</th>
                  <th>Direction</th>
                  <th>Adapter</th>
                </tr>
              </thead>
              <tbody>
                {runtime.map((p) => (
                  <tr key={String(p.key ?? p.providerKey)}>
                    <td>
                      <code>{String(p.key ?? p.providerKey)}</code>
                    </td>
                    <td>{String(p.displayName ?? '—')}</td>
                    <td>{String(p.direction ?? '—')}</td>
                    <td>{String(p.adapterKind ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="ai-providers-static">
        <h2 id="ai-providers-static" className={styles.panelTitle}>
          Static catalog (not runtime authority)
        </h2>
        <p className={styles.muted}>
          StaticIsRuntimeAuthority={String(query.data?.staticIsRuntimeAuthority ?? false)}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Executable</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((p) => (
                <tr key={String(p.typeId)}>
                  <td>{String(p.displayName ?? p.typeId)}</td>
                  <td>{String(p.category ?? '—')}</td>
                  <td>
                    <StatusBadge status={String(p.status ?? 'inactive')} />
                  </td>
                  <td>{String(p.executable ?? false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
