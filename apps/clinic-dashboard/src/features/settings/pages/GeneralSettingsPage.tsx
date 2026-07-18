import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { CLINIC_TYPES } from '../config/settings-config';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import styles from '../settings-layout.module.css';

export function GeneralSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    name: '',
    timezone: 'UTC',
    locale: 'en-US',
    legalName: '',
    registrationNumber: '',
    country: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    workingHours: '',
    defaultCurrency: 'USD',
    clinicType: 'medical',
  });

  useEffect(() => {
    if (!settings.data) return;
    const profile = settings.data.clinicProfile ?? {};
    setForm({
      name: settings.data.name,
      timezone: settings.data.timezone,
      locale: settings.data.locale,
      legalName: String(profile.legalName ?? ''),
      registrationNumber: String(profile.registrationNumber ?? ''),
      country: String(profile.country ?? ''),
      city: String(profile.city ?? ''),
      address: String(profile.address ?? ''),
      phone: String(profile.phone ?? ''),
      email: String(profile.email ?? ''),
      website: String(profile.website ?? ''),
      workingHours: String(profile.workingHours ?? ''),
      defaultCurrency: String(profile.defaultCurrency ?? 'USD'),
      clinicType: String(profile.clinicType ?? 'medical'),
    });
    setDirty(false);
  }, [settings.data]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  useUnsavedChangesGuard(dirty);

  function handleSave() {
    save.mutate(
      {
        name: form.name,
        timezone: form.timezone,
        locale: form.locale,
        clinicProfile: {
          legalName: form.legalName,
          registrationNumber: form.registrationNumber,
          country: form.country,
          city: form.city,
          address: form.address,
          phone: form.phone,
          email: form.email,
          website: form.website,
          workingHours: form.workingHours,
          defaultCurrency: form.defaultCurrency,
          clinicType: form.clinicType,
        },
      },
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
          <h2 className={styles.pageTitle}>{t('settings.general.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.general.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={handleSave} onCancel={() => settings.refetch()} />
      </header>

      {save.isError && <AuthAlert variant="error">{t('settings.saveError')}</AuthAlert>}
      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}

      <section className={styles.panel}>
        <AuthFormField id="clinic-name" label={t('settings.general.clinicName')} value={form.name} onChange={(e) => update('name', e.target.value)} />
        <AuthFormField id="legal-name" label={t('settings.general.legalName')} value={form.legalName} onChange={(e) => update('legalName', e.target.value)} />
        <AuthFormField id="registration" label={t('settings.general.registration')} value={form.registrationNumber} onChange={(e) => update('registrationNumber', e.target.value)} />
        <AuthFormField id="clinic-type" label={t('settings.general.clinicType')}>
          <select id="clinic-type" className={styles.select} value={form.clinicType} onChange={(e) => update('clinicType', e.target.value)}>
            {CLINIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`settings.general.clinicTypes.${type}`)}
              </option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField id="timezone" label={t('settings.general.timezone')} value={form.timezone} onChange={(e) => update('timezone', e.target.value)} />
        <AuthFormField id="currency" label={t('settings.general.currency')} value={form.defaultCurrency} onChange={(e) => update('defaultCurrency', e.target.value)} />
        <AuthFormField id="phone" label={t('settings.general.phone')} value={form.phone} onChange={(e) => update('phone', e.target.value)} dir="ltr" />
        <AuthFormField id="email" label={t('settings.general.email')} value={form.email} onChange={(e) => update('email', e.target.value)} type="email" dir="ltr" />
        <AuthFormField id="country" label={t('settings.general.country')} value={form.country} onChange={(e) => update('country', e.target.value)} />
        <AuthFormField id="city" label={t('settings.general.city')} value={form.city} onChange={(e) => update('city', e.target.value)} />
        <AuthFormField id="website" label={t('settings.general.website')} value={form.website} onChange={(e) => update('website', e.target.value)} dir="ltr" />
        <AuthFormField id="address" label={t('settings.general.address')} value={form.address} onChange={(e) => update('address', e.target.value)} />
        <AuthFormField id="working-hours" label={t('settings.general.workingHours')} value={form.workingHours} onChange={(e) => update('workingHours', e.target.value)} />
      </section>
    </div>
  );
}
