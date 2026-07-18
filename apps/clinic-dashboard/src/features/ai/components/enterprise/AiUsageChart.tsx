import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AiAdminUsage, AiOverview } from '../../api/ai-api';
import e from '../../ai-enterprise.module.css';

export function AiUsageChart({
  data,
  admin,
  mode = 'daily',
}: {
  data: AiOverview | AiAdminUsage;
  admin?: boolean;
  mode?: 'daily' | 'monthly';
}) {
  const { t } = useI18n();
  const bars = useMemo(() => {
    if (admin && 'daily' in data) {
      if (mode === 'monthly' && data.monthly?.length) {
        const peak = Math.max(...data.monthly.map((d) => d.messages), 1);
        return data.monthly.map((d) => ({
          label: d.month.slice(5),
          value: d.messages,
          max: peak,
        }));
      }
      const peak = Math.max(...data.daily.map((d) => d.messages), 1);
      return data.daily.map((d) => ({
        label: d.date.slice(5),
        value: d.messages,
        max: peak,
      }));
    }
    const overview = data as AiOverview;
    return [
      { label: t('ai.dashboard.tokens'), value: overview.tokensConsumed, max: Math.max(overview.tokensConsumed, 1) },
      { label: t('ai.dashboard.conversations'), value: overview.activeConversations, max: Math.max(overview.activeConversations, 1) },
      { label: t('ai.dashboard.todayActivity'), value: overview.messagesToday, max: Math.max(overview.messagesToday, 1) },
      { label: t('ai.dashboard.successRate'), value: overview.successRate, max: 100 },
      { label: t('ai.dashboard.responseTime'), value: overview.avgResponseMs, max: Math.max(overview.avgResponseMs, 1) },
    ];
  }, [data, admin, mode, t]);

  const chartLabel =
    admin && mode === 'monthly' ? t('ai.admin.monthlyUsage') : admin ? t('ai.admin.dailyUsage') : t('ai.dashboard.overview');

  return (
    <div>
      <div className={e.chartBars} role="img" aria-label={chartLabel}>
        {bars.map((bar) => (
          <div key={bar.label} className={e.chartBarRow}>
            <span className={e.chartBarLabel}>{bar.label}</span>
            <div className={e.chartBarTrack}>
              <div className={e.chartBarFill} style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%` }} />
            </div>
            <span className={e.chartBarValue}>{bar.value}</span>
          </div>
        ))}
      </div>
      <table className={[e.adminTable, e.srOnly].join(' ')}>
        <caption>{chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{t('ai.a11y.chartMetric')}</th>
            <th scope="col">{t('ai.a11y.chartValue')}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.label}>
              <th scope="row">{bar.label}</th>
              <td>{bar.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
