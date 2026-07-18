import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { MODULE_FLAGS } from '../config/settings-config';
import { useIdentityFeatures, useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import styles from '../settings-layout.module.css';

export function FeatureFlagsSettingsPage() {
  const { t } = useI18n();
  const features = useIdentityFeatures();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const merged = useMemo(() => {
    const base = { ...(features.data ?? {}), ...(settings.data?.moduleFlags ?? {}) };
    return { ...base, ...localFlags };
  }, [features.data, settings.data?.moduleFlags, localFlags]);

  function toggle(flag: string) {
    setLocalFlags((prev) => ({ ...prev, [flag]: !merged[flag] }));
    setDirty(true);
  }

  if (features.isLoading || settings.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.features.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.features.subtitle')}</p>
        </div>
        <AuthButton
          loading={save.isPending}
          disabled={!dirty}
          onClick={() =>
            save.mutate({ moduleFlags: localFlags }, { onSuccess: () => { setLocalFlags({}); setDirty(false); } })
          }
        >
          {t('settings.actions.save')}
        </AuthButton>
      </header>

      <section className={styles.panel}>
        {MODULE_FLAGS.map((flag) => (
          <label key={flag} className={styles.navLink} style={{ justifyContent: 'space-between' }}>
            <span>{t(`settings.features.flags.${flag}`)}</span>
            <input
              type="checkbox"
              checked={Boolean(merged[flag])}
              onChange={() => toggle(flag)}
              aria-label={t(`settings.features.flags.${flag}`)}
            />
          </label>
        ))}
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
