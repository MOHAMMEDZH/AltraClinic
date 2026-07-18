import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function NotificationDefaultsSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    appointmentReminders: true,
    paymentReminders: true,
    inventoryAlerts: true,
    securityAlerts: true,
    subscriptionAlerts: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    defaultChannels: { email: true, sms: false, whatsapp: false, inApp: true },
  });

  useEffect(() => {
    if (!settings.data) return;
    const n = settings.data.notificationSettings ?? {};
    setForm({
      appointmentReminders: Boolean(n.appointmentReminders ?? true),
      paymentReminders: Boolean(n.paymentReminders ?? true),
      inventoryAlerts: Boolean(n.inventoryAlerts ?? true),
      securityAlerts: Boolean(n.securityAlerts ?? true),
      subscriptionAlerts: Boolean(n.subscriptionAlerts ?? true),
      quietHoursStart: String(n.quietHoursStart ?? '22:00'),
      quietHoursEnd: String(n.quietHoursEnd ?? '07:00'),
      defaultChannels: {
        email: Boolean((n.defaultChannels as Record<string, boolean>)?.email ?? true),
        sms: Boolean((n.defaultChannels as Record<string, boolean>)?.sms ?? false),
        whatsapp: Boolean((n.defaultChannels as Record<string, boolean>)?.whatsapp ?? false),
        inApp: Boolean((n.defaultChannels as Record<string, boolean>)?.inApp ?? true),
      },
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.notificationDefaults.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.notificationDefaults.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={() => save.mutate({ notificationSettings: form }, { onSuccess: () => setDirty(false) })} onCancel={() => settings.refetch()} />
      </header>

      <section className={styles.panel}>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.appointmentReminders} onChange={(e) => { setForm((p) => ({ ...p, appointmentReminders: e.target.checked })); setDirty(true); }} />{t('settings.notificationDefaults.appointments')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.paymentReminders} onChange={(e) => { setForm((p) => ({ ...p, paymentReminders: e.target.checked })); setDirty(true); }} />{t('settings.notificationDefaults.payments')}</label>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={form.inventoryAlerts} onChange={(e) => { setForm((p) => ({ ...p, inventoryAlerts: e.target.checked })); setDirty(true); }} />{t('settings.notificationDefaults.inventory')}</label>
        <AuthFormField id="quiet-start" label={t('settings.notificationDefaults.quietStart')} value={form.quietHoursStart} onChange={(e) => { setForm((p) => ({ ...p, quietHoursStart: e.target.value })); setDirty(true); }} dir="ltr" />
        <AuthFormField id="quiet-end" label={t('settings.notificationDefaults.quietEnd')} value={form.quietHoursEnd} onChange={(e) => { setForm((p) => ({ ...p, quietHoursEnd: e.target.value })); setDirty(true); }} dir="ltr" />
      </section>

      <section className={styles.panel}>
        <Link to="/settings/notifications/channels" className={styles.kpiCard}>{t('settings.integrations.notifications')}</Link>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
