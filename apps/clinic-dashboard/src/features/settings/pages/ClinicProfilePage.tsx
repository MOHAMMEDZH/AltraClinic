import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { CLINIC_TYPES } from '../config/settings-config';
import { SettingsLogoField } from '../components/SettingsLogoField';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import styles from '../settings-layout.module.css';

const SPECIALTY_OPTIONS = ['general', 'pediatrics', 'dermatology', 'orthodontics', 'cosmetic', 'physiotherapy'] as const;

type SocialKey = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'whatsapp';

const SOCIAL_KEYS: SocialKey[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'whatsapp'];

export function ClinicProfilePage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    description: '',
    clinicType: 'medical',
    specialties: [] as string[],
    publicProfileEnabled: false,
    logoStorageKey: '',
    mapLabel: '',
    mapLatitude: '',
    mapLongitude: '',
    social: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      whatsapp: '',
    },
  });

  useEffect(() => {
    if (!settings.data) return;
    const profile = settings.data.clinicProfile ?? {};
    const social = (profile.socialLinks ?? {}) as Record<string, string>;
    const map = (profile.mapLocation ?? {}) as Record<string, string>;
    setForm({
      description: String(profile.description ?? ''),
      clinicType: String(profile.clinicType ?? 'medical'),
      specialties: Array.isArray(profile.specialties) ? (profile.specialties as string[]) : [],
      publicProfileEnabled: Boolean(profile.publicProfileEnabled),
      logoStorageKey: String(profile.logoStorageKey ?? ''),
      mapLabel: String(map.label ?? ''),
      mapLatitude: String(map.latitude ?? ''),
      mapLongitude: String(map.longitude ?? ''),
      social: {
        facebook: String(social.facebook ?? ''),
        instagram: String(social.instagram ?? ''),
        twitter: String(social.twitter ?? ''),
        linkedin: String(social.linkedin ?? ''),
        whatsapp: String(social.whatsapp ?? ''),
      },
    });
    setDirty(false);
  }, [settings.data]);

  function updateSocial(key: SocialKey, value: string) {
    setForm((prev) => ({ ...prev, social: { ...prev.social, [key]: value } }));
    setDirty(true);
  }

  function toggleSpecialty(specialty: string) {
    setForm((prev) => {
      const next = prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty];
      return { ...prev, specialties: next };
    });
    setDirty(true);
  }

  function handleSave() {
    save.mutate(
      {
        clinicProfile: {
          description: form.description,
          clinicType: form.clinicType,
          specialties: form.specialties,
          publicProfileEnabled: form.publicProfileEnabled,
          logoStorageKey: form.logoStorageKey,
          socialLinks: form.social,
          mapLocation: {
            label: form.mapLabel,
            latitude: form.mapLatitude,
            longitude: form.mapLongitude,
          },
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
          <h2 className={styles.pageTitle}>{t('settings.profile.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.profile.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" disabled={!dirty || save.isPending} onClick={() => settings.refetch()}>
            {t('settings.actions.cancel')}
          </AuthButton>
          <AuthButton loading={save.isPending} disabled={!dirty} onClick={handleSave}>
            {t('settings.actions.save')}
          </AuthButton>
        </div>
      </header>

      {save.isError && <AuthAlert variant="error">{t('settings.saveError')}</AuthAlert>}
      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="profile-identity">
        <h3 id="profile-identity" className={styles.panelTitle}>
          {t('settings.profile.identity')}
        </h3>
        <AuthFormField id="profile-description" label={t('settings.profile.description')}>
          <textarea
            id="profile-description"
            className={styles.input}
            rows={4}
            value={form.description}
            onChange={(e) => {
              setForm((p) => ({ ...p, description: e.target.value }));
              setDirty(true);
            }}
          />
        </AuthFormField>
        <AuthFormField id="profile-type" label={t('settings.profile.clinicType')}>
          <select
            id="profile-type"
            className={styles.select}
            value={form.clinicType}
            onChange={(e) => {
              setForm((p) => ({ ...p, clinicType: e.target.value }));
              setDirty(true);
            }}
          >
            {CLINIC_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`settings.general.clinicTypes.${type}`)}
              </option>
            ))}
          </select>
        </AuthFormField>
        <SettingsLogoField
          id="profile-logo"
          label={t('settings.profile.logo')}
          helpText={t('settings.profile.logoHint')}
          value={form.logoStorageKey}
          onChange={(mediaId) => {
            setForm((p) => ({ ...p, logoStorageKey: mediaId }));
            setDirty(true);
          }}
        />
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldsetLegend}>{t('settings.profile.specialties')}</legend>
          <div className={styles.checkboxGrid} role="group" aria-label={t('settings.profile.specialties')}>
            {SPECIALTY_OPTIONS.map((specialty) => (
              <label key={specialty} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.specialties.includes(specialty)}
                  onChange={() => toggleSpecialty(specialty)}
                />
                {t(`settings.profile.specialtyOptions.${specialty}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.publicProfileEnabled}
            onChange={(e) => {
              setForm((p) => ({ ...p, publicProfileEnabled: e.target.checked }));
              setDirty(true);
            }}
          />
          {t('settings.profile.publicProfile')}
        </label>
      </section>

      <section className={styles.panel} aria-labelledby="profile-location">
        <h3 id="profile-location" className={styles.panelTitle}>
          {t('settings.profile.location')}
        </h3>
        <AuthFormField
          id="map-label"
          label={t('settings.profile.mapLabel')}
          value={form.mapLabel}
          onChange={(e) => {
            setForm((p) => ({ ...p, mapLabel: e.target.value }));
            setDirty(true);
          }}
        />
        <AuthFormField
          id="map-lat"
          label={t('settings.profile.latitude')}
          value={form.mapLatitude}
          onChange={(e) => {
            setForm((p) => ({ ...p, mapLatitude: e.target.value }));
            setDirty(true);
          }}
          dir="ltr"
        />
        <AuthFormField
          id="map-lng"
          label={t('settings.profile.longitude')}
          value={form.mapLongitude}
          onChange={(e) => {
            setForm((p) => ({ ...p, mapLongitude: e.target.value }));
            setDirty(true);
          }}
          dir="ltr"
        />
      </section>

      <section className={styles.panel} aria-labelledby="profile-social">
        <h3 id="profile-social" className={styles.panelTitle}>
          {t('settings.profile.social')}
        </h3>
        {SOCIAL_KEYS.map((key) => (
          <AuthFormField
            key={key}
            id={`social-${key}`}
            label={t(`settings.profile.socialLinks.${key}`)}
            value={form.social[key]}
            onChange={(e) => updateSocial(key, e.target.value)}
            dir="ltr"
          />
        ))}
      </section>
    </div>
  );
}
