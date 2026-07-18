import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Clock, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { AI_WORKSPACES } from './config/ai-workspaces';
import { aiWorkspaceFeature } from './config/ai-subscription';
import { useAiOverview, useAiProviderHealth, useAiSubscriptionLimits } from './hooks/useAiChat';
import { useAiSubscription } from './hooks/useAiSubscription';
import { useRunSmartAction } from './hooks/useRunSmartAction';
import { AiMetricGrid } from './components/enterprise/AiMetricGrid';
import { AiUsageChart } from './components/enterprise/AiUsageChart';
import { AiSection } from './components/enterprise/AiSection';
import { AiPromptChipBar } from './components/prompts/AiPromptChipBar';
import e from './ai-enterprise.module.css';

function formatAiProviderLabel(provider: string, t: (key: never) => string): string {
  if (provider === 'skill') return t('ai.dashboard.builtinAssistant' as never);
  if (provider === 'template') return t('ai.dashboard.templateOnly' as never);
  return provider;
}

export function AiHomePage() {
  const { t, locale } = useI18n();
  const overviewQuery = useAiOverview();
  const healthQuery = useAiProviderHealth();
  const limitsQuery = useAiSubscriptionLimits();
  const { tier, canUse } = useAiSubscription();
  const { runPrompt, error: runError } = useRunSmartAction();
  const data = overviewQuery.data;
  const health = data?.providerHealth ?? healthQuery.data;
  const limits = data?.subscription ?? limitsQuery.data;

  const metrics = useMemo(
    () =>
      data
        ? [
            { id: 'tokens', label: t('ai.dashboard.tokens'), value: data.tokensConsumed.toLocaleString(locale), meta: t('ai.dashboard.tokensHint') },
            { id: 'conversations', label: t('ai.dashboard.conversations'), value: data.activeConversations, href: '/ai/history' },
            { id: 'success', label: t('ai.dashboard.successRate'), value: `${data.successRate}%`, icon: TrendingUp },
            { id: 'response', label: t('ai.dashboard.responseTime'), value: `${data.avgResponseMs}ms`, icon: Clock },
            { id: 'models', label: t('ai.dashboard.models'), value: data.deployedModels, href: '/ai/admin' },
            { id: 'activity', label: t('ai.dashboard.todayActivity'), value: data.messagesToday, icon: Activity },
          ]
        : [],
    [t, locale, data],
  );

  return (
    <>
      <header className={e.pageHeader}>
        <div>
          <h2 className={e.pageTitle}>{t('ai.dashboard.title')}</h2>
          <p className={e.pageSubtitle}>{t('ai.dashboard.subtitle')}</p>
        </div>
        <div className={e.pageActions}>
          <Link to="/ai/chat" className={e.promptChip} style={{ padding: '8px 14px', textDecoration: 'none' }}>
            <MessageSquare size={16} aria-hidden /> {t('ai.nav.chat')}
          </Link>
        </div>
      </header>

      <AiSection title={t('ai.dashboard.overview')} hint={`${t('ai.subscription.plan')}: ${tier}`}>
        {overviewQuery.isLoading || !data ? (
          <div role="status" aria-busy="true" aria-label={t('ai.a11y.loading')}>
            <WidgetSkeleton span="full" />
          </div>
        ) : overviewQuery.isError ? (
          <AuthAlert variant="error">{t('ai.a11y.loadError')}</AuthAlert>
        ) : (
          <AiMetricGrid items={metrics} />
        )}
      </AiSection>

      {data && (
        <AiSection title={t('ai.dashboard.usageChart')} hint={t('ai.dashboard.overview')}>
          <AiUsageChart data={data} />
        </AiSection>
      )}

      <AiSection title={t('ai.dashboard.workspaces')} hint={t('ai.dashboard.workspacesHint')}>
        <div className={e.workspaceGrid} role="list" aria-label={t('ai.dashboard.workspaces')}>
          {AI_WORKSPACES.map((ws) => {
            const feature = aiWorkspaceFeature(ws.id);
            const locked = !canUse(feature);
            const Icon = ws.icon;
            const title = t(ws.labelKey);
            const subtitle = t(ws.subtitleKey);

            if (locked) {
              return (
                <div
                  key={ws.id}
                  role="listitem"
                  className={[e.workspaceCard, e.workspaceCardLocked].join(' ')}
                  aria-labelledby={`ws-title-${ws.id}`}
                >
                  <span className={e.workspaceIcon} aria-hidden>
                    <Icon size={18} />
                  </span>
                  <strong id={`ws-title-${ws.id}`}>{title}</strong>
                  <span className={e.pageSubtitle}>{subtitle}</span>
                  <span className={e.sectionHint}>{t('ai.subscription.upgrade')}</span>
                  <Link to="/ai/settings" className={[e.sectionHint, e.workspaceCardLockedLink].join(' ')}>
                    {t('ai.nav.settings')}
                  </Link>
                </div>
              );
            }

            return (
              <Link
                key={ws.id}
                role="listitem"
                to={`/ai/workspaces/${ws.id}`}
                className={e.workspaceCard}
              >
                <span className={e.workspaceIcon} aria-hidden>
                  <Icon size={18} />
                </span>
                <strong>{title}</strong>
                <span className={e.pageSubtitle}>{subtitle}</span>
              </Link>
            );
          })}
        </div>
      </AiSection>

      <AiSection title={t('ai.dashboard.suggested')} flush>
        <div className={e.sectionBody}>
          {runError instanceof Error && (
            <AuthAlert variant="error">{runError.message}</AuthAlert>
          )}
          <AiPromptChipBar
            favoritesOnly
            limit={6}
            fallbackKeys={[
              'ai.prompts.medical.summary',
              'ai.prompts.reporting.revenue',
              'ai.prompts.reception.schedule',
            ]}
            onRun={(body, title) => void runPrompt(body, { title })}
          />
          <p className={e.pageSubtitle} style={{ marginTop: 'var(--space-3)' }} role="status">
            <Zap size={14} aria-hidden />{' '}
            {health
              ? `${t('ai.dashboard.activeProvider')}: ${formatAiProviderLabel(health.activeProvider, t)} · ${health.providers
                  .filter((p) => p.configured)
                  .map((p) => `${formatAiProviderLabel(p.provider, t)} (${p.status})`)
                  .join(', ') || t('ai.dashboard.templateOnly')}`
              : t('ai.dashboard.healthOk')}
          </p>
          {limits && (
            <p className={e.pageSubtitle} style={{ marginTop: 'var(--space-2)' }}>
              {t('ai.subscription.messagesToday')}: {limits.messagesToday} / {limits.limits.maxMessagesPerUserPerDay} ·{' '}
              {t('ai.subscription.rpm')}: {limits.limits.maxRequestsPerMinute}
            </p>
          )}
        </div>
      </AiSection>
    </>
  );
}
