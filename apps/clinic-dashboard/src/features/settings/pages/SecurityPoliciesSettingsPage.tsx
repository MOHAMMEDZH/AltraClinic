import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function SecurityPoliciesSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    minPasswordLength: '12',
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true,
    mfaRequired: false,
    sessionTimeoutMinutes: '60',
    maxFailedLogins: '5',
    lockoutMinutes: '30',
    ipRestrictionsEnabled: false,
    sensitiveActionConfirmation: true,
  });

  useEffect(() => {
    if (!settings.data) return;
    const p = settings.data.securityPolicy ?? {};
    setForm({
      minPasswordLength: String(p.minPasswordLength ?? '12'),
      requireUppercase: Boolean(p.requireUppercase ?? true),
      requireNumbers: Boolean(p.requireNumbers ?? true),
      requireSymbols: Boolean(p.requireSymbols ?? true),
      mfaRequired: Boolean(p.mfaRequired ?? false),
      sessionTimeoutMinutes: String(p.sessionTimeoutMinutes ?? '60'),
      maxFailedLogins: String(p.maxFailedLogins ?? '5'),
      lockoutMinutes: String(p.lockoutMinutes ?? '30'),
      ipRestrictionsEnabled: Boolean(p.ipRestrictionsEnabled ?? false),
      sensitiveActionConfirmation: Boolean(p.sensitiveActionConfirmation ?? true),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  if (settings.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.securityPolicies.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.securityPolicies.subtitle')}</p>
        </div>
        <SettingsFormToolbar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate({ securityPolicy: form }, { onSuccess: () => setDirty(false) })}
          onCancel={() => settings.refetch()}
        />
      </header>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.securityPolicies.password')}</h3>
        <AuthFormField id="min-pwd" label={t('settings.securityPolicies.minLength')} type="number" min={8} max={128} value={form.minPasswordLength} onChange={(e) => { setForm((p) => ({ ...p, minPasswordLength: e.target.value })); setDirty(true); }} />
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.requireUppercase} onChange={(e) => { setForm((p) => ({ ...p, requireUppercase: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.requireUpper')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.requireNumbers} onChange={(e) => { setForm((p) => ({ ...p, requireNumbers: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.requireNumbers')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.requireSymbols} onChange={(e) => { setForm((p) => ({ ...p, requireSymbols: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.requireSymbols')}</label>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.securityPolicies.access')}</h3>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.mfaRequired} onChange={(e) => { setForm((p) => ({ ...p, mfaRequired: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.mfaRequired')}</label>
        <AuthFormField id="session-timeout" label={t('settings.securityPolicies.sessionTimeout')} type="number" min={5} value={form.sessionTimeoutMinutes} onChange={(e) => { setForm((p) => ({ ...p, sessionTimeoutMinutes: e.target.value })); setDirty(true); }} />
        <AuthFormField id="max-failed" label={t('settings.securityPolicies.maxFailed')} type="number" min={1} value={form.maxFailedLogins} onChange={(e) => { setForm((p) => ({ ...p, maxFailedLogins: e.target.value })); setDirty(true); }} />
        <AuthFormField id="lockout" label={t('settings.securityPolicies.lockout')} type="number" min={1} value={form.lockoutMinutes} onChange={(e) => { setForm((p) => ({ ...p, lockoutMinutes: e.target.value })); setDirty(true); }} />
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.ipRestrictionsEnabled} onChange={(e) => { setForm((p) => ({ ...p, ipRestrictionsEnabled: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.ipRestrictions')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.sensitiveActionConfirmation} onChange={(e) => { setForm((p) => ({ ...p, sensitiveActionConfirmation: e.target.checked })); setDirty(true); }} />{t('settings.securityPolicies.sensitiveConfirm')}</label>
      </section>

      <section className={styles.panel}>
        <Link to="/settings/security" className={styles.kpiCard}>{t('settings.securityPolicies.userSecurity')}</Link>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
