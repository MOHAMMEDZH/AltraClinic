import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { FeatureGate } from '@/features/subscription/components/FeatureGate';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useAuth } from '@/app/providers/AuthProvider';
import { testIntegrationWebhook } from '../api/settings-api';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function IntegrationsSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const { getValidAccessToken, user } = useAuth();
  const [dirty, setDirty] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [form, setForm] = useState({
    emailProvider: 'smtp',
    smsProvider: 'twilio',
    whatsappProvider: 'meta',
    paymentGateway: 'stripe',
    accountingReady: false,
    calendarSync: false,
    webhooksEnabled: false,
    webhookUrl: '',
  });

  useEffect(() => {
    if (!settings.data) return;
    const i = settings.data.integrationSettings ?? {};
    setForm({
      emailProvider: String(i.emailProvider ?? 'smtp'),
      smsProvider: String(i.smsProvider ?? 'twilio'),
      whatsappProvider: String(i.whatsappProvider ?? 'meta'),
      paymentGateway: String(i.paymentGateway ?? 'stripe'),
      accountingReady: Boolean(i.accountingReady ?? false),
      calendarSync: Boolean(i.calendarSync ?? false),
      webhooksEnabled: Boolean(i.webhooksEnabled ?? false),
      webhookUrl: String(i.webhookUrl ?? ''),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  return (
    <FeatureGate featureId="integrations" featureName={t('settings.integrations.lockedTitle')} preview>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>{t('settings.integrations.title')}</h2>
            <p className={styles.pageSubtitle}>{t('settings.integrations.subtitle')}</p>
          </div>
          <SettingsFormToolbar dirty={dirty} saving={save.isPending} onSave={() => save.mutate({ integrationSettings: form }, { onSuccess: () => setDirty(false) })} onCancel={() => settings.refetch()} />
        </header>

        <section className={styles.panel}>
          <AuthFormField id="email-provider" label={t('settings.integrations.emailProvider')} value={form.emailProvider} onChange={(e) => { setForm((p) => ({ ...p, emailProvider: e.target.value })); setDirty(true); }} />
          <AuthFormField id="sms-provider" label={t('settings.integrations.smsProvider')} value={form.smsProvider} onChange={(e) => { setForm((p) => ({ ...p, smsProvider: e.target.value })); setDirty(true); }} />
          <AuthFormField id="whatsapp-provider" label={t('settings.integrations.whatsappProvider')} value={form.whatsappProvider} onChange={(e) => { setForm((p) => ({ ...p, whatsappProvider: e.target.value })); setDirty(true); }} />
          <AuthFormField id="payment-gateway" label={t('settings.integrations.paymentGateway')} value={form.paymentGateway} onChange={(e) => { setForm((p) => ({ ...p, paymentGateway: e.target.value })); setDirty(true); }} />
          <AuthFormField id="webhook-url" label={t('settings.integrations.webhookUrl')} value={form.webhookUrl} onChange={(e) => { setForm((p) => ({ ...p, webhookUrl: e.target.value })); setDirty(true); }} dir="ltr" />
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.webhooksEnabled} onChange={(e) => { setForm((p) => ({ ...p, webhooksEnabled: e.target.checked })); setDirty(true); }} />{t('settings.integrations.webhooksEnabled')}</label>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.accountingReady} onChange={(e) => { setForm((p) => ({ ...p, accountingReady: e.target.checked })); setDirty(true); }} />{t('settings.integrations.accountingReady')}</label>
          <label className={styles.checkboxLabel}><input type="checkbox" checked={form.calendarSync} onChange={(e) => { setForm((p) => ({ ...p, calendarSync: e.target.checked })); setDirty(true); }} />{t('settings.integrations.calendarSync')}</label>
          <AuthButton
            type="button"
            variant="secondary"
            loading={testingWebhook}
            disabled={!form.webhooksEnabled || !form.webhookUrl.trim()}
            onClick={async () => {
              setTestingWebhook(true);
              setWebhookResult(null);
              try {
                const token = await getValidAccessToken();
                if (!token || !user?.tenantId) return;
                if (dirty) {
                  await save.mutateAsync({ integrationSettings: form });
                  setDirty(false);
                }
                const result = await testIntegrationWebhook(token, user.tenantId);
                setWebhookResult(`${t('settings.integrations.webhookResult')}: ${result.ok ? 'OK' : 'Failed'} (${result.statusCode})`);
              } catch {
                setWebhookResult(t('settings.saveError'));
              } finally {
                setTestingWebhook(false);
              }
            }}
          >
            {t('settings.integrations.testWebhook')}
          </AuthButton>
          {webhookResult && <AuthAlert variant="info">{webhookResult}</AuthAlert>}
        </section>

        <section className={styles.panel}>
          <div className={styles.kpiGrid}>
            <Link to="/settings/notifications/channels" className={styles.kpiCard}>{t('settings.integrations.notifications')}</Link>
            <Link to="/settings/developer" className={styles.kpiCard}>{t('settings.integrations.developer')}</Link>
          </div>
        </section>

        {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
      </div>
    </FeatureGate>
  );
}
