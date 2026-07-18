import type { ReportCategoryId } from '../config/reporting-catalog';
import { REPORT_CATEGORIES } from '../config/reporting-catalog';

const CATEGORY_SET = new Set<string>(REPORT_CATEGORIES);

export function isReportCategoryId(value: string): value is ReportCategoryId {
  return CATEGORY_SET.has(value);
}

export function parseReportCategoryParam(raw: string | undefined): ReportCategoryId | null {
  if (!raw || !isReportCategoryId(raw)) return null;
  return raw;
}

export function buildReportCategoryUrl(categoryId: ReportCategoryId): string {
  return `/reports/category/${categoryId}`;
}

export function buildReportsHomeUrl(params?: { category?: string; q?: string }): string {
  const qs = new URLSearchParams();
  if (params?.category && params.category !== 'all') qs.set('category', params.category);
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  const suffix = qs.toString();
  return suffix ? `/reports?${suffix}` : '/reports';
}
