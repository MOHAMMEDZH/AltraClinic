import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { FeatureGate } from '@/features/subscription/components/FeatureGate';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useSettings';
import styles from '../settings-layout.module.css';

export function DeveloperSettingsPage() {
  const { t } = useI18n();
  const keys = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [name, setName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  return (
    <FeatureGate featureId="apiAccess" featureName={t('settings.developer.lockedTitle')} preview>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>{t('settings.developer.title')}</h2>
            <p className={styles.pageSubtitle}>{t('settings.developer.subtitle')}</p>
          </div>
        </header>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{t('settings.developer.apiKeys')}</h3>
          <div className={styles.toolbar}>
            <AuthFormField id="key-name" label={t('settings.developer.keyName')} value={name} onChange={(e) => setName(e.target.value)} />
            <AuthButton
              loading={createKey.isPending}
              disabled={!name.trim()}
              onClick={() =>
                createKey.mutate(name.trim(), {
                  onSuccess: (data) => {
                    setCreatedKey(data.key);
                    setName('');
                  },
                })
              }
            >
              {t('settings.developer.createKey')}
            </AuthButton>
          </div>
          {createdKey && (
            <AuthAlert variant="warning">
              {t('settings.developer.keyOnce')}: <code dir="ltr">{createdKey}</code>
            </AuthAlert>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('settings.developer.keyName')}</th>
                  <th>{t('settings.developer.prefix')}</th>
                  <th>{t('settings.developer.created')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(keys.data ?? []).map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td dir="ltr">{key.prefix}…</td>
                    <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                    <td>
                      <AuthButton variant="danger" onClick={() => setRevokeTarget(key.id)}>
                        {t('settings.developer.revoke')}
                      </AuthButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <p className={styles.pageSubtitle}>{t('settings.developer.docsHint')}</p>
        </section>

        <SettingsConfirmDialog
          open={Boolean(revokeTarget)}
          title={t('settings.developer.revokeTitle')}
          message={t('settings.developer.revokeConfirm')}
          destructive
          loading={revokeKey.isPending}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={() => {
            if (!revokeTarget) return;
            revokeKey.mutate(revokeTarget, { onSuccess: () => setRevokeTarget(null) });
          }}
        />
      </div>
    </FeatureGate>
  );
}
