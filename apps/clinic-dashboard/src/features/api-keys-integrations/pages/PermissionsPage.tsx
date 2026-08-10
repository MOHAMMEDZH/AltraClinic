import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import { useOpsPermissions } from '../hooks/useIntegrationsOps';
import { LoadingBlock } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function PermissionsPage() {
  const { user } = useAuth();
  const canView = canViewApiIntegrations(user?.roles?.map(String) ?? []);
  const query = useOpsPermissions(canView);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <AuthAlert variant="error">Failed to load permissions.</AuthAlert>;

  const actions = query.data?.actions ?? {};

  return (
    <section className={styles.panel} aria-labelledby="ai-perm-title">
      <h2 id="ai-perm-title" className={styles.panelTitle}>
        Permission matrix
      </h2>
      <p className={styles.muted}>
        Resource: <code>{query.data?.resource}</code>
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Action key</th>
              <th>Matrix action</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(actions).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <code>{v}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
