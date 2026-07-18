import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from '../../DashboardPage.module.css';

interface PatientGrowthChartProps {
  data: Array<{ date: string; count: number }>;
}

export function PatientGrowthChart({ data }: PatientGrowthChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <div className={styles.chartWrap} role="img" aria-label="Patient growth chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} width={32} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}
          />
          <Bar
            dataKey="count"
            fill="var(--color-success-500)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
