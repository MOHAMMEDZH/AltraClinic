export type AnalyticsKpiFormat = 'currency' | 'number' | 'percent' | 'text' | 'duration';

export interface AnalyticsKpiDto {
  id: string;
  labelKey: string;
  value: number | string;
  format: AnalyticsKpiFormat;
  href?: string;
}

export type AnalyticsChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'gauge' | 'heatmap' | 'stackedBar' | 'scatter' | 'funnel';

export interface AnalyticsChartSeriesDto {
  id: string;
  type: AnalyticsChartType;
  titleKey: string;
  data: unknown;
}

export interface AnalyticsTableDto {
  id: string;
  titleKey: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface AnalyticsBenchmarkDto {
  id: string;
  labelKey: string;
  current: number;
  previous: number;
  unit: 'currency' | 'number' | 'percent';
}

export interface AnalyticsDomainOverviewDto {
  domainId: string;
  generatedAt: string;
  kpis: AnalyticsKpiDto[];
  charts: AnalyticsChartSeriesDto[];
  tables: AnalyticsTableDto[];
  benchmarks?: AnalyticsBenchmarkDto[];
}
