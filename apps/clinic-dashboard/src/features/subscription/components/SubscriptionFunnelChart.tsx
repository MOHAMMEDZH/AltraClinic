import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@booking/i18n/react';
import styles from '../subscription-layout.module.css';

interface FunnelStep {
  id: string;
  labelKey: string;
  value: number;
}

interface SubscriptionFunnelChartProps {
  titleKey: string;
  steps: FunnelStep[];
}

export function SubscriptionFunnelChart({ titleKey, steps }: SubscriptionFunnelChartProps) {
  const { t, locale } = useI18n();
  const data = useMemo(
    () => steps.map((step) => ({ name: t(step.labelKey), value: step.value, id: step.id })),
    [steps, t],
  );

  if (!data.some((row) => row.value > 0)) {
    return <p className={styles.empty}>{t('subscription.analytics.noData')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t(titleKey)}>
      <h3 className={styles.panelTitle}>{t(titleKey)}</h3>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => [new Intl.NumberFormat(locale).format(Number(value ?? 0)), '']} />
            <Bar dataKey="value" fill="var(--color-primary-500)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
