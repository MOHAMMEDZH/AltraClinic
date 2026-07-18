import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function ReportsSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    defaultFormat: 'pdf',
    includeLogo: true,
    defaultRange: '30d',
    scheduledReportsEnabled: false,
    excelIncludeFormulas: false,
    shareExternally: false,
  });

  useEffect(() => {
    if (!settings.data) return;
    const r = settings.data.reportSettings ?? {};
    setForm({
      defaultFormat: String(r.defaultFormat ?? 'pdf'),
      includeLogo: Boolean(r.includeLogo ?? true),
      defaultRange: String(r.defaultRange ?? '30d'),
      scheduledReportsEnabled: Boolean(r.scheduledReportsEnabled ?? false),
      excelIncludeFormulas: Boolean(r.excelIncludeFormulas ?? false),
      shareExternally: Boolean(r.shareExternally ?? false),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.reports.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.reports.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={() => save.mutate({ reportSettings: form }, { onSuccess: () => setDirty(false) })} onCancel={() => settings.refetch()} />
      </header>

      <section className={styles.panel}>
        <AuthFormField id="default-format" label={t('settings.reports.defaultFormat')}>
          <select id="default-format" className={styles.select} value={form.defaultFormat} onChange={(e) => { setForm((p) => ({ ...p, defaultFormat: e.target.value })); setDirty(true); }}>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
          </select>
        </AuthFormField>
        <AuthFormField id="default-range" label={t('settings.reports.defaultRange')}>
          <select id="default-range" className={styles.select} value={form.defaultRange} onChange={(e) => { setForm((p) => ({ ...p, defaultRange: e.target.value })); setDirty(true); }}>
            <option value="7d">{t('settings.reports.ranges.7d')}</option>
            <option value="30d">{t('settings.reports.ranges.30d')}</option>
            <option value="90d">{t('settings.reports.ranges.90d')}</option>
          </select>
        </AuthFormField>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.includeLogo} onChange={(e) => { setForm((p) => ({ ...p, includeLogo: e.target.checked })); setDirty(true); }} />{t('settings.reports.includeLogo')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.scheduledReportsEnabled} onChange={(e) => { setForm((p) => ({ ...p, scheduledReportsEnabled: e.target.checked })); setDirty(true); }} />{t('settings.reports.scheduled')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.excelIncludeFormulas} onChange={(e) => { setForm((p) => ({ ...p, excelIncludeFormulas: e.target.checked })); setDirty(true); }} />{t('settings.reports.excelFormulas')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.shareExternally} onChange={(e) => { setForm((p) => ({ ...p, shareExternally: e.target.checked })); setDirty(true); }} />{t('settings.reports.shareExternal')}</label>
      </section>

      <section className={styles.panel}>
        <div className={styles.kpiGrid}>
          <Link to="/reports" className={styles.kpiCard}>{t('settings.reports.home')}</Link>
          <Link to="/reports/builder" className={styles.kpiCard}>{t('settings.reports.builder')}</Link>
        </div>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
