/**
 * Phase 45e — Operational reporting domain (OD-REPORT).
 * Ops summaries only — not clinical KPIs or Analytics.
 */

export type OpsReportKind =
  | 'availability_summary'
  | 'error_budget_mvp'
  | 'failing_components'
  | 'queue_pressure'
  | 'alert_volume';

export interface OpsReportSection {
  id: string;
  title: string;
  rows: readonly Record<string, string | number | boolean | null>[];
}

export interface OpsReport {
  kind: OpsReportKind;
  title: string;
  tenantId: string | null;
  generatedAt: string;
  dormant: boolean;
  sections: readonly OpsReportSection[];
  schemaVersion: '45e';
}
