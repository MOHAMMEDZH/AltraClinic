import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { SettingsConfirmDialog } from '@/features/settings/components/SettingsConfirmDialog';
import {
  canManageApiIntegrations,
  canViewApiIntegrations,
} from '../config/api-integrations-config';
import {
  useGatewayQuotas,
  useGatewayUsage,
  useIntegrationsMutations,
  useIntegrationsOpsDashboard,
} from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function QuotasUsagePage() {
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const canManage = canManageApiIntegrations(roles);
  const dash = useIntegrationsOpsDashboard(canView);
  const quotas = useGatewayQuotas(canManage);
  const usage = useGatewayUsage(canManage);
  const mutations = useIntegrationsMutations();
  const [resetOpen, setResetOpen] = useState(false);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;

  const totals = usage.data
    ? ((usage.data as { totals?: Record<string, number> }).totals ?? {})
    : dash.data?.usage?.totals ?? {};

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ai-quota-title">
        <h2 id="ai-quota-title" className={styles.panelTitle}>
          Quotas & usage
        </h2>
        <p className={styles.muted}>
          In-process quota backend (OD-REDIS deferred). Manage required for live quota APIs.
        </p>
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{totals.success ?? 0}</p>
            <p className={styles.statLabel}>Auth success</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{totals.authFailure ?? 0}</p>
            <p className={styles.statLabel}>Auth failures</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{totals.authorizationFailure ?? 0}</p>
            <p className={styles.statLabel}>Authz failures</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{totals.quotaFailure ?? 0}</p>
            <p className={styles.statLabel}>Quota failures</p>
          </div>
        </div>
        {canManage ? (
          <AuthButton type="button" variant="secondary" onClick={() => setResetOpen(true)}>
            Reset quota windows
          </AuthButton>
        ) : null}
      </section>

      {canManage ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Quota diagnostics</h2>
          {quotas.isLoading || usage.isLoading ? <LoadingBlock /> : null}
          {quotas.isError || usage.isError ? (
            <AuthAlert variant="error">Quota/usage APIs unavailable.</AuthAlert>
          ) : null}
          {quotas.data ? (
            <pre className={styles.secretBox} style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(quotas.data, null, 2)}
            </pre>
          ) : (
            <EmptyState title="No quota payload" />
          )}
        </section>
      ) : null}

      <SettingsConfirmDialog
        open={resetOpen}
        title="Reset quotas"
        message="Clears in-process sliding windows and burst buckets for this node."
        loading={mutations.resetQuotas.isPending}
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await mutations.resetQuotas.mutateAsync(undefined);
          setResetOpen(false);
        }}
      />
    </div>
  );
}
