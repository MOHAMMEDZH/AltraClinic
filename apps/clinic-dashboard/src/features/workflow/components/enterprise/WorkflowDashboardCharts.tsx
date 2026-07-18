import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@booking/i18n/react';
import type { WorkflowOverview } from '../../api/workflow-api';
import e from '../../workflow-enterprise.module.css';

const STATUS_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#64748b'];

interface WorkflowDashboardChartsProps {
  data: WorkflowOverview;
}

export function WorkflowDashboardCharts({ data }: WorkflowDashboardChartsProps) {
  const { t } = useI18n();

  const statusDistribution = [
    { name: t('workflow.kpi.active'), value: data.activeWorkflows },
    { name: t('workflow.kpi.pendingApprovals'), value: data.pendingApprovals },
    { name: t('workflow.kpi.overdue'), value: data.overdueTasks },
    { name: t('workflow.enterprise.failedExecutions'), value: data.failedWorkflows },
    { name: t('workflow.kpi.completedToday'), value: data.completedToday },
  ].filter((row) => row.value > 0);

  const roleChart = (data.taskLoadByRole ?? []).map((r) => ({
    role: r.role.replace(/_/g, ' '),
    count: r.count,
  }));

  const branchChart = (data.taskLoadByBranch ?? []).map((b, i) => ({
    name: b.branchId ? `Branch ${i + 1}` : t('workflow.enterprise.allBranches'),
    count: b.count,
  }));

  const activityByHour = buildActivityHeat(data.recentActivity ?? []);

  return (
    <div className={e.chartGrid}>
      <div className={[e.section, e.chartPanel].join(' ')}>
        <div className={e.sectionHeader}>
          <h3 className={e.sectionTitle}>{t('workflow.enterprise.statusDistribution')}</h3>
        </div>
        <div className={e.sectionBody}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {statusDistribution.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {roleChart.length > 0 && (
        <div className={[e.section, e.chartPanel].join(' ')}>
          <div className={e.sectionHeader}>
            <h3 className={e.sectionTitle}>{t('workflow.kpi.taskLoadByRole')}</h3>
          </div>
          <div className={e.sectionBody}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roleChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {branchChart.length > 0 && (
        <div className={[e.section, e.chartPanel].join(' ')}>
          <div className={e.sectionHeader}>
            <h3 className={e.sectionTitle}>{t('workflow.enterprise.branchLoad')}</h3>
          </div>
          <div className={e.sectionBody}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={branchChart} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activityByHour.length > 0 && (
        <div className={[e.section, e.chartPanel].join(' ')}>
          <div className={e.sectionHeader}>
            <h3 className={e.sectionTitle}>{t('workflow.enterprise.activityHeat')}</h3>
          </div>
          <div className={e.sectionBody}>
            <div className={e.heatGrid}>
              {activityByHour.map((cell) => (
                <div
                  key={cell.label}
                  className={e.heatCell}
                  style={{
                    background: `color-mix(in srgb, var(--color-primary-500) ${Math.min(90, cell.intensity * 18)}%, var(--color-surface))`,
                  }}
                >
                  <div>{cell.label}</div>
                  <div>{cell.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildActivityHeat(
  activity: Array<{ createdAt: string }>,
): Array<{ label: string; count: number; intensity: number }> {
  const buckets = new Map<number, number>();
  for (const item of activity) {
    const hour = new Date(item.createdAt).getHours();
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }
  const max = Math.max(1, ...buckets.values());
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      count,
      intensity: count / max,
    }));
}
