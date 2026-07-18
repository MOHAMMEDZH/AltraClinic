import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useAiSettingsQuery, useSaveAiSettingsMutation } from './hooks/useAiPrompts';
import { useAiSubscription } from './hooks/useAiSubscription';
import { AiSection } from './components/enterprise/AiSection';
import e from './ai-enterprise.module.css';

type SettingsShape = {
  preferredLanguage: 'en-US' | 'ar-SY';
  preferredModel: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  streaming: boolean;
  saveHistory: boolean;
  temperature: number;
  voiceReady: boolean;
};

const defaults: SettingsShape = {
  preferredLanguage: 'en-US',
  preferredModel: 'assistant',
  responseLength: 'balanced',
  streaming: true,
  saveHistory: true,
  temperature: 0.4,
  voiceReady: false,
};

export function AiSettingsPage() {
  const { t } = useI18n();
  const settingsQuery = useAiSettingsQuery();
  const saveMutation = useSaveAiSettingsMutation();
  const { limits, planName } = useAiSubscription();
  const [settings, setSettings] = useState<SettingsShape>(defaults);
  const builtinOnly = limits ? !limits.limits.externalProvidersEnabled : false;

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings({ ...defaults, ...(settingsQuery.data as SettingsShape) });
    }
  }, [settingsQuery.data]);

  return (
    <>
      <header className={e.pageHeader}>
        <div>
          <h2 className={e.pageTitle}>{t('ai.nav.settings')}</h2>
          <p className={e.pageSubtitle}>{t('ai.settings.subtitle')}</p>
        </div>
      </header>

      {limits && (
        <AiSection title={t('ai.subscription.quotaTitle')} hint={`${t('ai.subscription.plan')}: ${planName}`}>
          <ul className={e.pageSubtitle}>
            <li>
              {t('ai.subscription.messagesToday')}: {limits.messagesToday} / {limits.limits.maxMessagesPerUserPerDay}
            </li>
            <li>
              {t('ai.subscription.tokensToday')}: {limits.tokensTodayTenant.toLocaleString()} /{' '}
              {limits.limits.maxTokensPerTenantPerDay.toLocaleString()}
            </li>
            <li>
              {t('ai.subscription.rpm')}: {limits.limits.maxRequestsPerMinute}
            </li>
          </ul>
        </AiSection>
      )}

      <AiSection title={t('ai.settings.preferences')}>
        {settingsQuery.isError && <AuthAlert variant="error">{t('ai.a11y.settingsLoadError')}</AuthAlert>}
        {settingsQuery.isLoading && (
          <p className={e.pageSubtitle} role="status" aria-busy="true">
            {t('ai.a11y.loading')}
          </p>
        )}
        {builtinOnly && (
          <p className={e.pageSubtitle} style={{ marginBottom: 'var(--space-3)' }}>
            {t('ai.settings.builtinNote')}
          </p>
        )}
        <form
          className={e.shell}
          onSubmit={(ev) => {
            ev.preventDefault();
            void saveMutation.mutateAsync(settings);
          }}
        >
          <AuthFormField label={t('ai.settings.language')} id="ai-lang">
            <select
              id="ai-lang"
              className={e.input}
              value={settings.preferredLanguage}
              onChange={(ev) => setSettings((s) => ({ ...s, preferredLanguage: ev.target.value as SettingsShape['preferredLanguage'] }))}
            >
              <option value="en-US">English</option>
              <option value="ar-SY">العربية</option>
            </select>
          </AuthFormField>
          <AuthFormField label={t('ai.settings.model')} id="ai-model">
            <select
              id="ai-model"
              className={e.input}
              value={settings.preferredModel}
              onChange={(ev) => setSettings((s) => ({ ...s, preferredModel: ev.target.value }))}
              disabled={builtinOnly}
            >
              {builtinOnly ? (
                <option value="assistant">{t('ai.settings.builtinModel')}</option>
              ) : (
                <>
                  <option value="assistant">Assistant</option>
                  <option value="summary">Summary</option>
                  <option value="insight">Insight</option>
                </>
              )}
            </select>
          </AuthFormField>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="ai-streaming"
              type="checkbox"
              checked={settings.streaming}
              onChange={(ev) => setSettings((s) => ({ ...s, streaming: ev.target.checked }))}
            />
            <label htmlFor="ai-streaming">{t('ai.settings.streaming')}</label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="ai-save-history"
              type="checkbox"
              checked={settings.saveHistory}
              onChange={(ev) => setSettings((s) => ({ ...s, saveHistory: ev.target.checked }))}
            />
            <label htmlFor="ai-save-history">{t('ai.settings.saveHistory')}</label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="ai-voice-ready"
              type="checkbox"
              checked={settings.voiceReady}
              onChange={(ev) => setSettings((s) => ({ ...s, voiceReady: ev.target.checked }))}
            />
            <label htmlFor="ai-voice-ready">{t('ai.settings.voiceReady')}</label>
          </div>
          <AuthFormField label={t('ai.settings.temperature')} id="ai-temp">
            <input
              id="ai-temp"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={settings.temperature}
              aria-valuetext={String(settings.temperature)}
              onChange={(ev) => setSettings((s) => ({ ...s, temperature: Number(ev.target.value) }))}
            />
            <span className={e.srOnly} aria-live="polite">
              {settings.temperature}
            </span>
          </AuthFormField>
          <AuthButton type="submit" loading={saveMutation.isPending} loadingLabel={t('ai.a11y.saving')}>
            {t('ai.settings.save')}
          </AuthButton>
        </form>
      </AiSection>
    </>
  );
}
