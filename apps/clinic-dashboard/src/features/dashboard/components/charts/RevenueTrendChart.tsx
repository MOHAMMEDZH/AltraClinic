import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../../lib/dashboard-format';
import styles from '../../DashboardPage.module.css';

interface RevenueTrendChartProps {
  data: Array<{ date: string; amount: number }>;
  locale: string;
}

export function RevenueTrendChart({ data, locale }: RevenueTrendChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <div className={styles.chartWrap} role="img" aria-label="Revenue trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} />
          <YAxis
            tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
            tickFormatter={(v) => formatCurrency(Number(v), locale).replace(/\s/g, '\u00a0')}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0), locale)}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--color-primary-500)"
            strokeWidth={2}
            fill="url(#revenueFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
