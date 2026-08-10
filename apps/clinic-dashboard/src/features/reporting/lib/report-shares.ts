export type ReportShareAccess = 'read' | 'edit';

export function buildReportShareLink(reportId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/reports/${reportId}`;
}