import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './QueueThroughputChart.module.css';

interface QueueThroughputChartProps {
  data: Array<{ hour: string; completed: number; avgWaitMinutes: number }>;
}

export function QueueThroughputChart({ data }: QueueThroughputChartProps) {
  const formatted = data.filter((d) => d.completed > 0);

  if (formatted.length === 0) {
    return <p className={styles.empty}>No completed visits yet today.</p>;
  }

  return (
    <div className={styles.wrap} role="img" aria-label="Queue throughput by hour">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }} width={32} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}
          />
          <Bar
            dataKey="completed"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
