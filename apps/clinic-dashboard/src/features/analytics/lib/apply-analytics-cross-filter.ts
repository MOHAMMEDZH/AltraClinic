import type { AnalyticsChartSeries, AnalyticsDomainOverview } from '../api/analytics-api';
import type { AnalyticsCrossFilterSelection } from '../components/AnalyticsCrossFilterContext';

function rowDimension(row: Record<string, unknown>): { dimension: string; value: string } | null {
  const value =
    row.name ?? row.status ?? row.method ?? row.label ?? row.date ?? row.branch ?? row.provider ?? row.diagnosis;
  if (value == null) return null;
  const dimension = row.name
    ? 'name'
    : row.status
      ? 'status'
      : row.method
        ? 'method'
        : row.date
          ? 'date'
          : 'label';
  return { dimension, value: String(value) };
}

function filterRows(rows: unknown[], selection: AnalyticsCrossFilterSelection | null): unknown[] {
  if (!selection || !Array.isArray(rows)) return rows;
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return true;
    const dim = rowDimension(row as Record<string, unknown>);
    return !dim || (dim.dimension === selection.dimension && dim.value === selection.value);
  });
}

export function applyCrossFilterToOverview(
  data: AnalyticsDomainOverview,
  selection: AnalyticsCrossFilterSelection | null,
): AnalyticsDomainOverview {
  if (!selection) return data;

  return {
    ...data,
    charts: data.charts.map((chart) => filterChart(chart, selection)),
    tables: data.tables.map((table) => ({
      ...table,
      rows: table.rows.filter((row) => {
        const firstCol = table.columns[0];
        const val = String(row[firstCol] ?? '');
        return val === selection.value || selection.chartId === table.id;
      }),
    })),
  };
}

function filterChart(chart: AnalyticsChartSeries, selection: AnalyticsCrossFilterSelection): AnalyticsChartSeries {
  if (chart.id === selection.chartId) return chart;

  if (chart.type === 'gauge' || chart.type === 'heatmap') return chart;

  if (chart.type === 'line' || chart.type === 'area') {
    const payload = chart.data as
      | { historical?: Array<Record<string, unknown>>; forecast?: Array<Record<string, unknown>> }
      | Array<Record<string, unknown>>;
    if (Array.isArray(payload)) {
      return { ...chart, data: filterRows(payload, selection) as typeof chart.data };
    }
    return {
      ...chart,
      data: {
        historical: filterRows(payload.historical ?? [], selection) as Array<Record<string, unknown>>,
        forecast: payload.forecast,
      },
    };
  }

  if (Array.isArray(chart.data)) {
    return { ...chart, data: filterRows(chart.data, selection) };
  }

  return chart;
}

export function chartDimensionFromPoint(
  chartId: string,
  payload: Record<string, unknown>,
): AnalyticsCrossFilterSelection {
  const dim = rowDimension(payload) ?? { dimension: 'label', value: String(payload.label ?? chartId) };
  return { chartId, dimension: dim.dimension, value: dim.value };
}
