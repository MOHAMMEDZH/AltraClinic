import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function AdvancedSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [form, setForm] = useState({
    retention: '365',
    backupFrequency: 'daily',
    backupRetentionDays: '30',
    maintenanceMode: false,
    allowDataExport: true,
    allowDataImport: true,
    cacheResetOnDeploy: false,
  });

  useEffect(() => {
    if (!settings.data) return;
    const adv = settings.data.advancedSettings ?? {};
    setForm({
      retention: String(settings.data.dataRetentionDays ?? '365'),
      backupFrequency: String(adv.backupFrequency ?? 'daily'),
      backupRetentionDays: String(adv.backupRetentionDays ?? '30'),
      maintenanceMode: Boolean(adv.maintenanceMode ?? false),
      allowDataExport: Boolean(adv.allowDataExport ?? true),
      allowDataImport: Boolean(adv.allowDataImport ?? true),
      cacheResetOnDeploy: Boolean(adv.cacheResetOnDeploy ?? false),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  function handleSave() {
    save.mutate(
      {
        dataRetentionDays: Number(form.retention),
        advancedSettings: {
          backupFrequency: form.backupFrequency,
          backupRetentionDays: form.backupRetentionDays,
          maintenanceMode: form.maintenanceMode,
          allowDataExport: form.allowDataExport,
          allowDataImport: form.allowDataImport,
          cacheResetOnDeploy: form.cacheResetOnDeploy,
        },
      },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.advanced.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.advanced.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={handleSave} onCancel={() => settings.refetch()} />
      </header>

      <section className={styles.panel}>
        <AuthFormField id="retention-days" label={t('settings.advanced.retention')} type="number" min={30} value={form.retention} onChange={(e) => { setForm((p) => ({ ...p, retention: e.target.value })); setDirty(true); }} />
        <AuthFormField id="backup-freq" label={t('settings.advanced.backupFrequency')}>
          <select id="backup-freq" className={styles.select} value={form.backupFrequency} onChange={(e) => { setForm((p) => ({ ...p, backupFrequency: e.target.value })); setDirty(true); }}>
            <option value="daily">{t('settings.advanced.freq.daily')}</option>
            <option value="weekly">{t('settings.advanced.freq.weekly')}</option>
            <option value="monthly">{t('settings.advanced.freq.monthly')}</option>
          </select>
        </AuthFormField>
        <AuthFormField id="backup-retention" label={t('settings.advanced.backupRetention')} type="number" min={7} value={form.backupRetentionDays} onChange={(e) => { setForm((p) => ({ ...p, backupRetentionDays: e.target.value })); setDirty(true); }} />
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.allowDataExport} onChange={(e) => { setForm((p) => ({ ...p, allowDataExport: e.target.checked })); setDirty(true); }} />{t('settings.advanced.allowExport')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.allowDataImport} onChange={(e) => { setForm((p) => ({ ...p, allowDataImport: e.target.checked })); setDirty(true); }} />{t('settings.advanced.allowImport')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.cacheResetOnDeploy} onChange={(e) => { setForm((p) => ({ ...p, cacheResetOnDeploy: e.target.checked })); setDirty(true); }} />{t('settings.advanced.cacheReset')}</label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(e) => {
              if (e.target.checked) setConfirmMaintenance(true);
              else {
                setForm((p) => ({ ...p, maintenanceMode: false }));
                setDirty(true);
              }
            }}
          />
          {t('settings.advanced.maintenanceMode')}
        </label>
      </section>

      <SettingsConfirmDialog
        open={confirmMaintenance}
        title={t('settings.advanced.maintenanceTitle')}
        message={t('settings.advanced.maintenanceConfirm')}
        destructive
        onCancel={() => setConfirmMaintenance(false)}
        onConfirm={() => {
          setForm((p) => ({ ...p, maintenanceMode: true }));
          setDirty(true);
          setConfirmMaintenance(false);
        }}
      />

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
