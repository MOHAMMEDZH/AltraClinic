import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useOptionalAudit } from '@/features/dynamic-audit/context/DynamicAuditProvider';
import { resolveAuditCenterConfig } from '@/features/dynamic-audit/lib/audit-read-model';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function AuditSettingsPage() {
  const { t } = useI18n();
  const auditCtx = useOptionalAudit();
  const auditConfig = resolveAuditCenterConfig(auditCtx?.snapshot);
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    auditRetentionDays: '365',
    trackSecurityEvents: true,
    trackFinancialEvents: true,
    trackMedicalEvents: true,
    trackUserActivity: true,
    exportEnabled: true,
  });

  useEffect(() => {
    if (!settings.data) return;
    const a = settings.data.auditSettings ?? {};
    setForm({
      auditRetentionDays: String(a.auditRetentionDays ?? settings.data.dataRetentionDays ?? '365'),
      trackSecurityEvents: Boolean(a.trackSecurityEvents ?? true),
      trackFinancialEvents: Boolean(a.trackFinancialEvents ?? true),
      trackMedicalEvents: Boolean(a.trackMedicalEvents ?? true),
      trackUserActivity: Boolean(a.trackUserActivity ?? true),
      exportEnabled: Boolean(a.exportEnabled ?? true),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.audit.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.audit.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={() => save.mutate({ auditSettings: form }, { onSuccess: () => setDirty(false) })} onCancel={() => settings.refetch()} />
      </header>

      <section className={styles.panel}>
        <AuthFormField id="audit-retention" label={t('settings.audit.retentionDays')} type="number" min={30} value={form.auditRetentionDays} onChange={(e) => { setForm((p) => ({ ...p, auditRetentionDays: e.target.value })); setDirty(true); }} />
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.trackSecurityEvents} onChange={(e) => { setForm((p) => ({ ...p, trackSecurityEvents: e.target.checked })); setDirty(true); }} />{t('settings.audit.trackSecurity')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.trackFinancialEvents} onChange={(e) => { setForm((p) => ({ ...p, trackFinancialEvents: e.target.checked })); setDirty(true); }} />{t('settings.audit.trackFinancial')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.trackMedicalEvents} onChange={(e) => { setForm((p) => ({ ...p, trackMedicalEvents: e.target.checked })); setDirty(true); }} />{t('settings.audit.trackMedical')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.trackUserActivity} onChange={(e) => { setForm((p) => ({ ...p, trackUserActivity: e.target.checked })); setDirty(true); }} />{t('settings.audit.trackUsers')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.exportEnabled} onChange={(e) => { setForm((p) => ({ ...p, exportEnabled: e.target.checked })); setDirty(true); }} disabled={auditCtx != null && !auditConfig.canExport} />{t('settings.audit.exportEnabled')}</label>
        <p className={styles.pageSubtitle}>{t('settings.audit.dataRetentionHint')}</p>
      </section>

      <section className={styles.panel}>
        <Link to="/settings/users/audit" className={styles.kpiCard}>{t('settings.audit.usersAudit')}</Link>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
