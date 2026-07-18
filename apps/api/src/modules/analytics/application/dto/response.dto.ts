/**
 * Response DTOs for Analytics API
 */

/**
 * Metric Response DTO
 */
export class MetricResponseDTO {
  metricId!: string;
  tenantId!: string;
  branchId?: string;
  metricName!: string;
  metricValue!: {
    value: number | string;
    type: string;
    unit: string | null;
    precision: number;
  };
  dimensionFilter!: Record<string, string | undefined>;
  timestamp!: string;
  recordedBy!: string;
  createdAt!: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard Widget Config Response DTO
 */
export class DashboardWidgetResponseDTO {
  widgetId!: string;
  metricName!: string;
  title!: string;
  description?: string;
  position!: number;
  size!: string;
  chartType!: string;
  refreshInterval?: number;
  dimensionFilters?: Record<string, string>;
}

/**
 * Dashboard Response DTO
 */
export class DashboardResponseDTO {
  dashboardId!: string;
  tenantId!: string;
  branchId?: string;
  name!: string;
  description?: string;
  dashboardType!: string;
  widgets!: DashboardWidgetResponseDTO[];
  createdBy!: string;
  createdAt!: string;
  updatedAt!: string;
  isDefault!: boolean;
  isPublic!: boolean;
  favoriteCount!: number;
}

/**
 * Analytics Report Response DTO
 */
export class AnalyticsReportResponseDTO {
  reportId!: string;
  tenantId!: string;
  branchId?: string;
  name!: string;
  description?: string;
  reportType!: string;
  format!: string;
  createdBy!: string;
  parameters?: Record<string, unknown>;
  recipientEmails!: string[];
  status!: string;
  createdAt!: string;
  updatedAt!: string;
  completedAt?: string;
  downloadUrl?: string;
  rowCount!: number;
  isScheduled!: boolean;
  scheduleFrequency?: string;
}

/**
 * List Response DTO
 */
export class ListResponseDTO<T> {
  data!: T[];
  total!: number;
  limit!: number;
  offset!: number;
  hasMore!: boolean;
}

/**
 * Command Response DTO
 */
export class CommandResponseDTO {
  id!: string;
  status!: string;
  timestamp!: string;
}
