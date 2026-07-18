import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { FeatureGate } from '@/features/subscription/components/FeatureGate';
import { useOptionalWhiteLabel } from '@/features/dynamic-white-label/context/DynamicWhiteLabelProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { SettingsLogoField } from '../components/SettingsLogoField';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function BrandingSettingsPage() {
  const { t } = useI18n();
  const whiteLabel = useOptionalWhiteLabel();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [form, setForm] = useState({
    primaryColor: '#2563eb',
    accentColor: '#0ea5e9',
    logoStorageKey: '',
    faviconStorageKey: '',
    themePreference: 'system',
    invoiceBranding: true,
    reportBranding: true,
    emailBranding: true,
    patientPortalBranding: true,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const branding = settings.data?.branding ?? {};
    setForm({
      primaryColor: String(branding.primaryColor ?? '#2563eb'),
      accentColor: String(branding.accentColor ?? '#0ea5e9'),
      logoStorageKey: String(branding.logoStorageKey ?? ''),
      faviconStorageKey: String(branding.faviconStorageKey ?? ''),
      themePreference: String(branding.themePreference ?? 'system'),
      invoiceBranding: Boolean(branding.invoiceBranding ?? true),
      reportBranding: Boolean(branding.reportBranding ?? true),
      emailBranding: Boolean(branding.emailBranding ?? true),
      patientPortalBranding: Boolean(branding.patientPortalBranding ?? true),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  return (
    <FeatureGate featureId="customBranding" featureName={t('settings.branding.lockedTitle')} preview>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>{t('settings.branding.title')}</h2>
            <p className={styles.pageSubtitle}>{t('settings.branding.subtitle')}</p>
          </div>
          <SettingsFormToolbar
            dirty={dirty}
            saving={save.isPending}
            onSave={() =>
              save.mutate(
                { branding: form },
                {
                  onSuccess: () => {
                    setDirty(false);
                    void whiteLabel?.refresh();
                  },
                },
              )
            }
            onCancel={() => settings.refetch()}
          />
        </header>

        <section className={styles.panel}>
          <SettingsLogoField
            id="brand-logo"
            label={t('settings.branding.logoKey')}
            helpText={t('settings.branding.logoHint')}
            value={form.logoStorageKey}
            onChange={(mediaId) => {
              setForm((p) => ({ ...p, logoStorageKey: mediaId }));
              setDirty(true);
            }}
          />
          <SettingsLogoField
            id="brand-favicon"
            label={t('settings.branding.favicon')}
            value={form.faviconStorageKey}
            onChange={(mediaId) => {
              setForm((p) => ({ ...p, faviconStorageKey: mediaId }));
              setDirty(true);
            }}
          />
          <AuthFormField id="primary-color" label={t('settings.branding.primaryColor')} value={form.primaryColor} onChange={(e) => { setForm((p) => ({ ...p, primaryColor: e.target.value })); setDirty(true); }} type="color" />
          <AuthFormField id="accent-color" label={t('settings.branding.accentColor')} value={form.accentColor} onChange={(e) => { setForm((p) => ({ ...p, accentColor: e.target.value })); setDirty(true); }} type="color" />
          <AuthFormField id="theme-pref" label={t('settings.branding.themePreference')}>
            <select id="theme-pref" className={styles.select} value={form.themePreference} onChange={(e) => { setForm((p) => ({ ...p, themePreference: e.target.value })); setDirty(true); }}>
              <option value="light">{t('shell.themeLight')}</option>
              <option value="dark">{t('shell.themeDark')}</option>
              <option value="system">{t('shell.themeSystem')}</option>
            </select>
          </AuthFormField>
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{t('settings.branding.surfaces')}</h3>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.invoiceBranding} onChange={(e) => { setForm((p) => ({ ...p, invoiceBranding: e.target.checked })); setDirty(true); }} />{t('settings.branding.invoice')}</label>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.reportBranding} onChange={(e) => { setForm((p) => ({ ...p, reportBranding: e.target.checked })); setDirty(true); }} />{t('settings.branding.reports')}</label>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.emailBranding} onChange={(e) => { setForm((p) => ({ ...p, emailBranding: e.target.checked })); setDirty(true); }} />{t('settings.branding.email')}</label>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.patientPortalBranding} onChange={(e) => { setForm((p) => ({ ...p, patientPortalBranding: e.target.checked })); setDirty(true); }} />{t('settings.branding.patientPortal')}</label>
        </section>

        {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
      </div>
    </FeatureGate>
  );
}
