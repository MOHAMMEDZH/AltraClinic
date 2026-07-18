import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { AiTenantProviderManagement, AiTenantProviderSettings } from '../../api/ai-api';
import { useUpdateAiAdminProviders } from '../../hooks/useAi';
import { AiSection } from './AiSection';
import e from '../../ai-enterprise.module.css';

function formatProviderLabel(provider: string, t: (key: never) => string): string {
  if (provider === 'skill') return t('ai.dashboard.builtinAssistant' as never);
  if (provider === 'template') return t('ai.dashboard.templateOnly' as never);
  return provider;
}

export function AiAdminProviderPanel({ management }: { management: AiTenantProviderManagement }) {
  const { t } = useI18n();
  const saveMutation = useUpdateAiAdminProviders();
  const [settings, setSettings] = useState<AiTenantProviderSettings>(management.settings);

  useEffect(() => {
    setSettings(management.settings);
  }, [management.settings]);

  const locked = !management.canManage;

  return (
    <AiSection title={t('ai.admin.providersTitle' as never)} hint={t('ai.admin.providersHint' as never)}>
      <div className={e.shell}>
        {locked && management.lockedReasonKey ? (
          <p className={e.pageSubtitle}>{t(management.lockedReasonKey as never)}</p>
        ) : null}

        <p className={e.pageSubtitle}>
          {t('ai.dashboard.activeProvider')}: {formatProviderLabel(management.effectiveActiveProvider, t)}
        </p>

        <div role="list">
          {management.providers.map((provider) => (
            <div key={provider.provider} className={e.providerRow} role="listitem">
              <div>
                <strong>{formatProviderLabel(provider.provider, t)}</strong>
                <p className={e.pageSubtitle}>{provider.model}</p>
              </div>
              <span className={[e.badge, provider.status === 'healthy' ? e.badgeDeployed : e.badgeDraft].join(' ')}>
                {provider.status}
              </span>
              <span className={e.pageSubtitle}>
                {provider.configured ? t('ai.admin.configured' as never) : t('ai.admin.notConfigured' as never)}
              </span>
            </div>
          ))}
        </div>

        <form
          className={e.shell}
          onSubmit={(ev) => {
            ev.preventDefault();
            void saveMutation.mutateAsync(settings);
          }}
        >
          <AuthFormField label={t('ai.admin.preferredProvider' as never)} id="ai-preferred-provider">
            <select
              id="ai-preferred-provider"
              className={e.input}
              value={settings.preferredExternalProvider}
              disabled={locked}
              onChange={(ev) =>
                setSettings((s) => ({
                  ...s,
                  preferredExternalProvider: ev.target.value as AiTenantProviderSettings['preferredExternalProvider'],
                }))
              }
            >
              <option value="auto">{t('ai.admin.providerAuto' as never)}</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </AuthFormField>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.geminiEnabled}
              disabled={locked}
              onChange={(ev) => setSettings((s) => ({ ...s, geminiEnabled: ev.target.checked }))}
            />
            {t('ai.admin.enableGemini' as never)}
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.openaiEnabled}
              disabled={locked}
              onChange={(ev) => setSettings((s) => ({ ...s, openaiEnabled: ev.target.checked }))}
            />
            {t('ai.admin.enableOpenai' as never)}
          </label>

          <AuthButton type="submit" loading={saveMutation.isPending} disabled={locked}>
            {t('ai.admin.saveProviders' as never)}
          </AuthButton>
        </form>
      </div>
    </AiSection>
  );
}
