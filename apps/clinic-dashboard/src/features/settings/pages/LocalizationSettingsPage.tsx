import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import styles from '../settings-layout.module.css';

const LOCALES = ['en-US', 'ar-SY'] as const;

export function LocalizationSettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [tenantLocale, setTenantLocale] = useState('en-US');
  const [formats, setFormats] = useState({ dateFormat: 'YYYY-MM-DD', timeFormat: '24h', numberFormat: 'en', currencyFormat: 'USD' });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setTenantLocale(settings.data.locale);
      const loc = settings.data.localizationSettings ?? {};
      setFormats({
        dateFormat: String(loc.dateFormat ?? 'YYYY-MM-DD'),
        timeFormat: String(loc.timeFormat ?? '24h'),
        numberFormat: String(loc.numberFormat ?? 'en'),
        currencyFormat: String(loc.currencyFormat ?? 'USD'),
      });
      setDirty(false);
    }
  }, [settings.data]);

  function handleSave() {
    save.mutate(
      { locale: tenantLocale, localizationSettings: formats },
      { onSuccess: () => setDirty(false) },
    );
  }

  if (settings.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.localization.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.localization.subtitle')}</p>
        </div>
        <AuthButton loading={save.isPending} disabled={!dirty} onClick={handleSave}>
          {t('settings.actions.save')}
        </AuthButton>
      </header>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.localization.tenantDefaults')}</h3>
        <AuthFormField id="tenant-locale" label={t('settings.localization.defaultLanguage')}>
          <select
            id="tenant-locale"
            className={styles.select}
            value={tenantLocale}
            onChange={(e) => {
              setTenantLocale(e.target.value);
              setDirty(true);
            }}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(`settings.localization.locales.${code}`)}
              </option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField id="date-format" label={t('settings.localization.dateFormat')} value={formats.dateFormat} onChange={(e) => { setFormats((p) => ({ ...p, dateFormat: e.target.value })); setDirty(true); }} dir="ltr" />
        <AuthFormField id="time-format" label={t('settings.localization.timeFormat')}>
          <select id="time-format" className={styles.select} value={formats.timeFormat} onChange={(e) => { setFormats((p) => ({ ...p, timeFormat: e.target.value })); setDirty(true); }}>
            <option value="12h">{t('settings.localization.time12')}</option>
            <option value="24h">{t('settings.localization.time24')}</option>
          </select>
        </AuthFormField>
        <AuthFormField id="number-format" label={t('settings.localization.numberFormat')} value={formats.numberFormat} onChange={(e) => { setFormats((p) => ({ ...p, numberFormat: e.target.value })); setDirty(true); }} dir="ltr" />
        <AuthFormField id="currency-format" label={t('settings.localization.currencyFormat')} value={formats.currencyFormat} onChange={(e) => { setFormats((p) => ({ ...p, currencyFormat: e.target.value })); setDirty(true); }} dir="ltr" />
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.localization.personal')}</h3>
        <p className={styles.pageSubtitle}>{t('settings.localization.personalHint')}</p>
        <AuthFormField id="ui-locale" label={t('settings.localization.uiLanguage')}>
          <select id="ui-locale" className={styles.select} value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(`settings.localization.locales.${code}`)}
              </option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField id="ui-theme" label={t('settings.localization.theme')}>
          <select id="ui-theme" className={styles.select} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="light">{t('shell.themeLight')}</option>
            <option value="dark">{t('shell.themeDark')}</option>
            <option value="system">{t('shell.themeSystem')}</option>
          </select>
        </AuthFormField>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
