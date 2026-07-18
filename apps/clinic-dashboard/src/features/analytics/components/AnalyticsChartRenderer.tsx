import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ZAxis,
} from 'recharts';
import { useI18n } from '@booking/i18n/react';
import { formatCurrency, formatNumber, formatPercent } from '@/features/dashboard/lib/dashboard-format';
import type { AnalyticsChartSeries } from '../api/analytics-api';
import { chartDimensionFromPoint } from '../lib/apply-analytics-cross-filter';
import { useAnalyticsCrossFilter } from './AnalyticsCrossFilterContext';
import styles from '../analytics-layout.module.css';

const PIE_COLORS = [
  'var(--color-primary-500)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-danger)',
  'var(--color-text-secondary)',
];

interface AnalyticsChartRendererProps {
  chart: AnalyticsChartSeries;
}

export function AnalyticsChartRenderer({ chart }: AnalyticsChartRendererProps) {
  const { t, locale } = useI18n();
  const { selection, toggleSelection, matches } = useAnalyticsCrossFilter();
  const title = t(chart.titleKey as 'analytics.title');

  function handlePointClick(payload: Record<string, unknown>) {
    toggleSelection(chartDimensionFromPoint(chart.id, payload));
  }

  function cellOpacity(label: string) {
    if (!selection || selection.chartId === chart.id) return 1;
    return matches('label', label) || matches('name', label) || matches('status', label) ? 1 : 0.35;
  }

  if (chart.type === 'gauge') {
    const data = chart.data as { utilizationPercent?: number; collectionPercent?: number; noShowPercent?: number };
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <div className={styles.kpiRow}>
          {data.utilizationPercent != null && (
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('dashboard.health.utilization')}</p>
              <p className={styles.kpiValue}>{formatPercent(data.utilizationPercent, locale)}</p>
            </div>
          )}
          {data.collectionPercent != null && (
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('dashboard.health.collection')}</p>
              <p className={styles.kpiValue}>{formatPercent(data.collectionPercent, locale)}</p>
            </div>
          )}
          {data.noShowPercent != null && (
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('dashboard.health.noShow')}</p>
              <p className={styles.kpiValue}>{formatPercent(data.noShowPercent, locale)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (chart.type === 'pie' || chart.type === 'donut') {
    const rows = Array.isArray(chart.data) ? chart.data : [];
    const pieData = rows.map((row: Record<string, unknown>, i) => ({
      name: String(row.name ?? row.status ?? row.method ?? row.code ?? i),
      value: Number(row.value ?? row.count ?? row.amount ?? 0),
      raw: row,
    }));
    const innerRadius = chart.type === 'donut' ? 48 : 0;
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={80}
              onClick={(_, index) => handlePointClick({ ...pieData[index].raw, name: pieData[index].name })}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                  opacity={cellOpacity(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === 'heatmap') {
    const rows = Array.isArray(chart.data) ? chart.data : [];
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <div className={styles.kpiRow}>
          {rows.map((row: { hour: number; count: number }) => (
            <button
              key={row.hour}
              type="button"
              className={styles.kpi}
              style={{
                background: `color-mix(in srgb, var(--color-primary-500) ${Math.min(100, row.count * 8)}%, var(--color-bg))`,
                opacity: cellOpacity(String(row.hour)),
              }}
              onClick={() => handlePointClick({ label: String(row.hour), count: row.count })}
            >
              <p className={styles.kpiLabel}>{row.hour}:00</p>
              <p className={styles.kpiValue}>{formatNumber(row.count, locale)}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (chart.type === 'scatter') {
    const rows = Array.isArray(chart.data) ? chart.data : [];
    const scatterData = rows.map((row: Record<string, unknown>) => ({
      x: Number(row.appointments ?? row.x ?? 0),
      y: Number(row.encounters ?? row.revenue ?? row.y ?? 0),
      name: String(row.name ?? ''),
      raw: row,
    }));
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="appointments" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="encounters" tick={{ fontSize: 11 }} />
            <ZAxis range={[60, 400]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={scatterData}
              fill="var(--color-primary-500)"
              onClick={(p) => handlePointClick({ ...(p.payload as { raw: Record<string, unknown> }).raw, name: (p.payload as { name: string }).name })}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === 'stackedBar') {
    const rows = Array.isArray(chart.data) ? chart.data : [];
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rows as Array<Record<string, unknown>>}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="collections" stackId="a" fill="var(--color-success)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="invoiced" stackId="a" fill="var(--color-primary-500)" radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === 'line' || chart.type === 'area') {
    const payload = chart.data as
      | { historical?: Array<Record<string, unknown>>; forecast?: Array<Record<string, unknown>>; confidence?: Array<Record<string, unknown>> }
      | Array<Record<string, unknown>>;
    const historical = Array.isArray(payload) ? payload : (payload.historical ?? []);
    const forecast = Array.isArray(payload) ? [] : (payload.forecast ?? []);
    const rows = [
      ...historical.map((r) => ({
        label: String(r.date ?? r.day ?? ''),
        value: Number(r.amount ?? r.count ?? r.collections ?? 0),
        kind: 'historical' as const,
      })),
      ...forecast.map((r) => ({
        label: String(r.date ?? ''),
        value: Number(r.amount ?? r.count ?? 0),
        kind: 'forecast' as const,
      })),
    ];
    const ChartComponent = chart.type === 'area' ? AreaChart : LineChart;
    const Series = chart.type === 'area' ? Area : Line;
    return (
      <div className={styles.chart} aria-label={title}>
        <p className={styles.panelTitle}>{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ChartComponent data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Series
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary-500)"
              fill="var(--color-primary-200)"
              strokeDasharray="4 4"
              dot={{
                r: 3,
                onClick: (_event, dotProps) => {
                  const point = dotProps as { payload?: { label?: string } };
                  handlePointClick({ label: String(point.payload?.label ?? '') });
                },
              }}
              activeDot={{ r: 5 }}
            />
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    );
  }

  const rows = Array.isArray(chart.data) ? chart.data : [];
  const barData = rows.map((row: Record<string, unknown>, i) => ({
    label: String(row.name ?? row.date ?? row.firstName ?? row.branchId ?? i),
    value: Number(row.amount ?? row.count ?? row.appointments ?? row.revenue ?? row.encounters ?? 0),
    raw: row,
  }));

  return (
    <div className={styles.chart} aria-label={title}>
      <p className={styles.panelTitle}>{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              chart.id.includes('revenue') ? formatCurrency(v, locale) : formatNumber(v, locale)
            }
          />
          <Tooltip
            formatter={(value) =>
              chart.id.includes('revenue')
                ? formatCurrency(Number(value), locale)
                : formatNumber(Number(value), locale)
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-primary-500)"
            radius={[4, 4, 0, 0]}
            onClick={(barData) => {
              const payload = barData as { payload?: { raw?: Record<string, unknown>; label?: string } };
              const raw = payload.payload?.raw ?? {};
              const label = payload.payload?.label ?? '';
              handlePointClick({ ...raw, label });
            }}
          >
            {barData.map((entry) => (
              <Cell key={entry.label} opacity={cellOpacity(entry.label)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
