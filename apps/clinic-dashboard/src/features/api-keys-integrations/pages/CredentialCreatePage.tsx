import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  API_INTEGRATIONS_BASE_PATH,
  canCreateApiIntegrations,
} from '../config/api-integrations-config';
import {
  useIntegrationsMutations,
  useOpsScopes,
} from '../hooks/useIntegrationsOps';
import { SecretRevealDialog } from '../components/SecretRevealDialog';
import { LoadingBlock } from '../components/StatusParts';
import styles from '../api-integrations-layout.module.css';

export function CredentialCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const scopesQuery = useOpsScopes(canCreateApiIntegrations(roles));
  const mutations = useIntegrationsMutations();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>(['ops.read']);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const scopeIds = useMemo(
    () => scopesQuery.data?.ids ?? selected,
    [scopesQuery.data, selected],
  );

  if (!canCreateApiIntegrations(roles)) {
    return <AuthAlert variant="error">Missing api.integrations:create.</AuthAlert>;
  }

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setError(null);
    try {
      const res = await mutations.createCredential.mutateAsync({
        name: name.trim(),
        scopes: selected,
        ownerType: 'user',
      });
      setCreatedId(res.credential.id);
      setReveal(res.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="ai-create-cred">
      <h2 id="ai-create-cred" className={styles.panelTitle}>
        {t('apiIntegrations.credentials.create', 'Create API credential')}
      </h2>
      {scopesQuery.isLoading ? <LoadingBlock /> : null}
      {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
      <div className={styles.formGrid}>
        <label className={styles.label}>
          Name
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <fieldset className={styles.label}>
          <legend>Scopes</legend>
          <div className={styles.actions}>
            {scopeIds.map((id) => (
              <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={() => toggle(id)}
                />
                {id}
              </label>
            ))}
          </div>
        </fieldset>
        <AuthButton
          type="button"
          onClick={submit}
          loading={mutations.createCredential.isPending}
          disabled={!name.trim() || selected.length === 0}
        >
          Issue credential
        </AuthButton>
      </div>
      <SecretRevealDialog
        open={Boolean(reveal)}
        title="One-time API key"
        secret={reveal}
        onClose={() => {
          setReveal(null);
          if (createdId) {
            navigate(`${API_INTEGRATIONS_BASE_PATH}/credentials/${createdId}`);
          }
        }}
      />
    </section>
  );
}
