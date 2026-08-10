import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  API_INTEGRATIONS_BASE_PATH,
  canCreateApiIntegrations,
  canViewApiIntegrations,
} from '../config/api-integrations-config';
import { useIntegrationsOpsDashboard } from '../hooks/useIntegrationsOps';
import { EmptyState, LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function OverviewPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const dash = useIntegrationsOpsDashboard(canView);

  if (!canView) {
    return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  }

  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError) {
    return (
      <AuthAlert variant="error">
        {t('apiIntegrations.errors.dashboard', 'Failed to load operations dashboard.')}
      </AuthAlert>
    );
  }

  const d = dash.data;
  if (!d) {
    return (
      <EmptyState
        title={t('apiIntegrations.empty.dashboard', 'No dashboard data')}
        detail="Enable the center flag and license to populate live counts."
      />
    );
  }

  return (
    <div className={styles.content}>
      <section className={styles.panel} aria-labelledby="ai-overview-title">
        <h2 id="ai-overview-title" className={styles.panelTitle}>
          {t('apiIntegrations.overview.title', 'Operations overview')}
        </h2>
        <p className={styles.muted}>
          Phase {d.phase} · generated {new Date(d.generatedAt).toLocaleString()}
        </p>
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{d.credentialCounts.total ?? 0}</p>
            <p className={styles.statLabel}>Credentials</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>{d.serviceAccountCounts.total ?? 0}</p>
            <p className={styles.statLabel}>Service accounts</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>
              {d.webhookCounts.subscriptionsActive ?? 0}
            </p>
            <p className={styles.statLabel}>Active webhooks</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>
              {d.webhookCounts.deliveriesDeadLetter ?? 0}
            </p>
            <p className={styles.statLabel}>Dead-lettered</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>
              <StatusBadge status={d.featureFlag.enabled ? 'on' : 'off'} />
            </p>
            <p className={styles.statLabel}>{d.featureFlag.name}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statValue}>
              <StatusBadge
                status={d.license.allowIntegrations ? 'active' : 'disabled'}
              />
            </p>
            <p className={styles.statLabel}>License</p>
          </div>
        </div>
        <div className={styles.actions}>
          {canCreateApiIntegrations(roles) ? (
            <Link to={`${API_INTEGRATIONS_BASE_PATH}/credentials/new`}>
              <AuthButton type="button">
                {t('apiIntegrations.actions.newCredential', 'New credential')}
              </AuthButton>
            </Link>
          ) : null}
          <Link to={`${API_INTEGRATIONS_BASE_PATH}/webhooks`} className={styles.linkBtn}>
            Webhooks
          </Link>
          <Link to={`${API_INTEGRATIONS_BASE_PATH}/health`} className={styles.linkBtn}>
            Health
          </Link>
          <Link to={`${API_INTEGRATIONS_BASE_PATH}/gateway`} className={styles.linkBtn}>
            Gateway
          </Link>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="ai-readiness-title">
        <h2 id="ai-readiness-title" className={styles.panelTitle}>
          Readiness
        </h2>
        <dl className={styles.dl}>
          <div className={styles.dlRow}>
            <dt>Pepper</dt>
            <dd>
              <StatusBadge status={d.readiness.pepperReady ? 'ready' : 'not ready'} />
            </dd>
          </div>
          <div className={styles.dlRow}>
            <dt>Secret store</dt>
            <dd>
              <StatusBadge
                status={d.readiness.secretStoreReady ? 'ready' : 'not ready'}
              />
            </dd>
          </div>
          <div className={styles.dlRow}>
            <dt>Queue</dt>
            <dd>{String(d.queue?.name ?? 'integrations-webhooks')}</dd>
          </div>
          <div className={styles.dlRow}>
            <dt>Migration</dt>
            <dd>{d.migrationStatus}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
