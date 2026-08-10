import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { SettingsConfirmDialog } from '@/features/settings/components/SettingsConfirmDialog';
import {
  API_INTEGRATIONS_BASE_PATH,
  canDeleteApiIntegrations,
  canUpdateApiIntegrations,
  canViewApiIntegrations,
  formatIso,
} from '../config/api-integrations-config';
import {
  useCredential,
  useIntegrationsMutations,
} from '../hooks/useIntegrationsOps';
import { SecretRevealDialog } from '../components/SecretRevealDialog';
import { LoadingBlock, StatusBadge } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function CredentialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const query = useCredential(id, canView);
  const mutations = useIntegrationsMutations();
  const [reveal, setReveal] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canView) return <AuthAlert variant="error">Missing permission.</AuthAlert>;
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) {
    return <AuthAlert variant="error">Credential not found or center dormant.</AuthAlert>;
  }

  const c = query.data;

  return (
    <section className={styles.panel} aria-labelledby="ai-cred-detail">
      <h2 id="ai-cred-detail" className={styles.panelTitle}>
        {c.name}
      </h2>
      <p className={styles.muted}>
        <Link className={styles.linkBtn} to={`${API_INTEGRATIONS_BASE_PATH}/credentials`}>
          ← Credentials
        </Link>
      </p>
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      <dl className={styles.dl}>
        <div className={styles.dlRow}>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={c.status} />
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Prefix</dt>
          <dd>
            <code>{c.prefix}</code>
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Scopes</dt>
          <dd>{c.scopes.join(', ')}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Owner</dt>
          <dd>
            {c.ownerType} · {c.ownerId}
          </dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Created</dt>
          <dd>{formatIso(c.createdAt)}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Last used</dt>
          <dd>{formatIso(c.lastUsedAt)}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Expires</dt>
          <dd>{formatIso(c.expiresAt)}</dd>
        </div>
        <div className={styles.dlRow}>
          <dt>Rotation grace</dt>
          <dd>{formatIso(c.rotationGraceEndsAt)}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        {canUpdateApiIntegrations(roles) &&
        c.status !== 'revoked' &&
        c.status !== 'expired' ? (
          <AuthButton
            type="button"
            loading={mutations.rotateCredential.isPending}
            onClick={async () => {
              try {
                const res = await mutations.rotateCredential.mutateAsync(c.id);
                setReveal(res.key);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Rotate failed');
              }
            }}
          >
            Rotate
          </AuthButton>
        ) : null}
        {canDeleteApiIntegrations(roles) &&
        c.status !== 'revoked' &&
        c.status !== 'expired' ? (
          <AuthButton type="button" variant="danger" onClick={() => setRevokeOpen(true)}>
            Revoke
          </AuthButton>
        ) : null}
      </div>
      <SecretRevealDialog
        open={Boolean(reveal)}
        title="Rotated API key (one-time)"
        secret={reveal}
        onClose={() => setReveal(null)}
      />
      <SettingsConfirmDialog
        open={revokeOpen}
        title="Revoke credential"
        message="Clients using this key will be rejected."
        destructive
        loading={mutations.revokeCredential.isPending}
        onCancel={() => setRevokeOpen(false)}
        onConfirm={async () => {
          await mutations.revokeCredential.mutateAsync({ id: c.id });
          setRevokeOpen(false);
        }}
      />
    </section>
  );
}
