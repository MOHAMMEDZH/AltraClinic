import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/features/dashboard/lib/dashboard-format';
import type { AnalyticsKpi } from '../api/analytics-api';

export function formatAnalyticsKpiValue(kpi: AnalyticsKpi, locale: string): string {
  if (kpi.format === 'text') return String(kpi.value);
  const num = typeof kpi.value === 'number' ? kpi.value : Number(kpi.value);
  if (Number.isNaN(num)) return String(kpi.value);
  switch (kpi.format) {
    case 'currency':
      return formatCurrency(num, locale);
    case 'percent':
      return formatPercent(num, locale);
    case 'duration':
      return `${formatNumber(num, locale)} min`;
    default:
      return formatNumber(num, locale);
  }
}
