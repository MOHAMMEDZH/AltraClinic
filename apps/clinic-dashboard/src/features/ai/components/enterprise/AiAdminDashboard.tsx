import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AiAdminOverview } from '../../api/ai-api';
import { AiSection } from './AiSection';
import { AiUsageChart } from './AiUsageChart';
import { AiAdminProviderPanel } from './AiAdminProviderPanel';
import e from '../../ai-enterprise.module.css';

function formatProviderLabel(provider: string, t: (key: never) => string): string {
  if (provider === 'skill') return t('ai.dashboard.builtinAssistant' as never);
  if (provider === 'template') return t('ai.dashboard.templateOnly' as never);
  return provider;
}

function FlagRow({ label, enabled }: { label: string; enabled: boolean }) {
  const { t } = useI18n();
  return (
    <div className={e.flagItem}>
      <span>{label}</span>
      <span className={[e.badge, enabled ? e.badgeDeployed : e.badgeDraft].join(' ')}>
        {enabled ? t('ai.admin.flagOn' as never) : t('ai.admin.flagOff' as never)}
      </span>
    </div>
  );
}

export function AiAdminDashboard({ overview }: { overview: AiAdminOverview }) {
  const { t, locale } = useI18n();
  const { usage, limits, featureFlags, costEstimate } = overview;

  const successRate = useMemo(
    () => (usage.totalMessages > 0 ? Math.round((usage.successCount / usage.totalMessages) * 100) : 100),
    [usage.successCount, usage.totalMessages],
  );

  const workspaceLabel = useMemo(() => {
    if (featureFlags.workspaces === 'all') return t('ai.admin.workspacesAll' as never);
    return featureFlags.workspaces.join(', ');
  }, [featureFlags.workspaces, t]);

  return (
    <>
      <AiSection title={t('ai.admin.usageTitle')} hint={t('ai.admin.usageHint')}>
        <div className={e.shell}>
          <div className={e.promptChips}>
            <span className={e.promptChip}>
              {t('ai.admin.totalTokens')}: {usage.totalTokens.toLocaleString(locale)}
            </span>
            <span className={e.promptChip}>
              {t('ai.admin.totalMessages')}: {usage.totalMessages.toLocaleString(locale)}
            </span>
            <span className={e.promptChip}>
              {t('ai.admin.activeUsers')}: {usage.activeUsers}
            </span>
            <span className={e.promptChip}>
              {t('ai.admin.successRate')}: {successRate}%
            </span>
          </div>
          <AiUsageChart data={usage} admin />
          {usage.monthly?.length ? <AiUsageChart data={usage} admin mode="monthly" /> : null}
        </div>
      </AiSection>

      <AiAdminProviderPanel management={overview.providerManagement} />

      <AiSection title={t('ai.admin.featureFlagsTitle' as never)} hint={t('ai.admin.featureFlagsHint' as never)}>
        <div className={e.flagGrid}>
          <FlagRow label={t('ai.admin.builtinOnlyMode' as never)} enabled={featureFlags.builtinOnlyMode} />
          <FlagRow label={t('ai.admin.externalProviders' as never)} enabled={featureFlags.externalProvidersEnabled} />
          <FlagRow label={t('ai.admin.attachments' as never)} enabled={featureFlags.attachmentsEnabled} />
          <FlagRow label={t('ai.admin.customPrompts' as never)} enabled={featureFlags.customPromptsEnabled} />
          <div className={e.flagItem}>
            <span>{t('ai.admin.workspaces' as never)}</span>
            <span className={e.pageSubtitle}>{workspaceLabel}</span>
          </div>
        </div>
      </AiSection>

      <AiSection title={t('ai.subscription.quotaTitle')} hint={`${t('ai.subscription.plan')}: ${limits.plan}`}>
        <ul className={e.pageSubtitle}>
          <li>
            {t('ai.subscription.messagesToday')}: {limits.messagesToday} / {limits.limits.maxMessagesPerUserPerDay}
          </li>
          <li>
            {t('ai.subscription.tokensToday')}: {limits.tokensTodayTenant.toLocaleString(locale)} /{' '}
            {limits.limits.maxTokensPerTenantPerDay.toLocaleString(locale)}
          </li>
          <li>
            {t('ai.subscription.rpm')}: {limits.limits.maxRequestsPerMinute}
          </li>
        </ul>
      </AiSection>

      <AiSection title={t('ai.admin.costTitle' as never)} hint={t(costEstimate.noteKey as never)}>
        <div className={e.promptChips}>
          <span className={e.promptChip}>
            {t('ai.admin.estimatedCost' as never)}: ${costEstimate.estimatedExternalCost.toFixed(2)} {costEstimate.currency}
          </span>
          <span className={e.promptChip}>
            {t('ai.admin.periodTokens' as never)}: {costEstimate.periodTokens.toLocaleString(locale)}
          </span>
        </div>
      </AiSection>

      <AiSection title={t('ai.admin.topUsersTitle' as never)} hint={t('ai.admin.topUsersHint' as never)} flush>
        {overview.topUsers.length === 0 ? (
          <p className={e.pageSubtitle} style={{ padding: 'var(--space-4)' }}>
            {t('ai.admin.noData' as never)}
          </p>
        ) : (
          <table className={e.adminTable}>
            <thead>
              <tr>
                <th scope="col">{t('ai.admin.userEmail' as never)}</th>
                <th scope="col">{t('ai.admin.totalMessages')}</th>
                <th scope="col">{t('ai.admin.totalTokens')}</th>
              </tr>
            </thead>
            <tbody>
              {overview.topUsers.map((row) => (
                <tr key={row.userId}>
                  <td>{row.email}</td>
                  <td>{row.messages.toLocaleString(locale)}</td>
                  <td>{row.tokens.toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AiSection>

      <AiSection title={t('ai.admin.breakdownTitle' as never)} hint={t('ai.admin.breakdownHint' as never)}>
        <div className={e.shell}>
          <h3 className={e.sectionTitle}>{t('ai.admin.providerBreakdown' as never)}</h3>
          {overview.providerBreakdown.length === 0 ? (
            <p className={e.pageSubtitle}>{t('ai.admin.noData' as never)}</p>
          ) : (
            <table className={e.adminTable}>
              <thead>
                <tr>
                  <th scope="col">{t('ai.admin.provider' as never)}</th>
                  <th scope="col">{t('ai.admin.inferenceCount' as never)}</th>
                </tr>
              </thead>
              <tbody>
                {overview.providerBreakdown.map((row) => (
                  <tr key={row.provider}>
                    <td>{formatProviderLabel(row.provider, t)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 className={e.sectionTitle}>{t('ai.admin.skillBreakdown' as never)}</h3>
          {overview.skillBreakdown.length === 0 ? (
            <p className={e.pageSubtitle}>{t('ai.admin.noData' as never)}</p>
          ) : (
            <table className={e.adminTable}>
              <thead>
                <tr>
                  <th scope="col">{t('ai.admin.skillId' as never)}</th>
                  <th scope="col">{t('ai.admin.inferenceCount' as never)}</th>
                </tr>
              </thead>
              <tbody>
                {overview.skillBreakdown.map((row) => (
                  <tr key={row.skillId}>
                    <td>{row.skillId}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AiSection>

      <AiSection title={t('ai.admin.auditTitle' as never)} hint={t('ai.admin.auditHint' as never)} flush>
        {overview.auditLog.length === 0 ? (
          <p className={e.pageSubtitle} style={{ padding: 'var(--space-4)' }}>
            {t('ai.admin.noAudit' as never)}
          </p>
        ) : (
          <table className={e.adminTable}>
            <thead>
              <tr>
                <th scope="col">{t('ai.admin.auditTime' as never)}</th>
                <th scope="col">{t('ai.admin.provider' as never)}</th>
                <th scope="col">{t('ai.admin.skillId' as never)}</th>
                <th scope="col">{t('ai.admin.totalTokens')}</th>
                <th scope="col">{t('ai.dashboard.responseTime')}</th>
              </tr>
            </thead>
            <tbody>
              {overview.auditLog.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                  <td>{formatProviderLabel(row.provider, t)}</td>
                  <td>{row.skillId ?? '—'}</td>
                  <td>{row.tokenCount}</td>
                  <td>{row.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AiSection>

      <AiSection title={t('ai.admin.skillsCatalogTitle' as never)} hint={t('ai.admin.skillsCatalogHint' as never)} flush>
        <table className={e.adminTable}>
          <thead>
            <tr>
              <th scope="col">{t('ai.admin.skillId' as never)}</th>
              <th scope="col">{t('ai.admin.workspace' as never)}</th>
            </tr>
          </thead>
          <tbody>
            {overview.skills.map((skill) => (
              <tr key={skill.id}>
                <td>{skill.id}</td>
                <td>{skill.workspace ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AiSection>
    </>
  );
}
