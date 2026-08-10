import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewApiIntegrations } from '../config/api-integrations-config';
import styles from '../api-integrations-shell.module.css';

/**
 * Phase 44a — empty operational shell.
 * No credential CRUD, webhook management, or business actions.
 */
export function ApiIntegrationsShellPage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];

  if (!canViewApiIntegrations(roles)) {
    return (
      <AuthAlert variant="error">
        Missing api.integrations:view permission.
      </AuthAlert>
    );
  }

  return (
    <div
      className={styles.shell}
      id="api-integrations-region"
      role="region"
      aria-labelledby="api-integrations-title"
    >
      <header className={styles.header}>
        <h1 id="api-integrations-title" className={styles.title}>
          API Keys &amp; Integrations
        </h1>
        <p className={styles.lede}>
          Foundation shell only. Credential lifecycle, webhooks, and gateway
          enforcement arrive in later Phase 44 sub-phases. The center remains
          dormant while <code>API_KEYS_INTEGRATIONS_CENTER_ENABLED</code> is off.
        </p>
      </header>
      <section className={styles.panel} aria-label="Center status">
        <p className={styles.statusLabel}>Status</p>
        <p className={styles.statusValue}>Dormant — Phase 44a foundation</p>
        <ul className={styles.list}>
          <li>No API key issuance</li>
          <li>No webhook workers</li>
          <li>No authentication middleware</li>
        </ul>
      </section>
    </div>
  );
}
