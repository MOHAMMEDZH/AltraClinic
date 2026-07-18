/**
 * Get Metric Query
 * Retrieves a single metric by ID
 */
export class GetMetricQuery {
  constructor(public readonly metricId: string, public readonly tenantId: string) {}
}

/**
 * List Metrics Query
 * Lists metrics with filtering and pagination
 */
export class ListMetricsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly branchId?: string,
    public readonly metricName?: string,
    public readonly startDate?: string,
    public readonly endDate?: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}

/**
 * Get Dashboard Query
 * Retrieves a single dashboard by ID
 */
export class GetDashboardQuery {
  constructor(public readonly dashboardId: string, public readonly tenantId: string) {}
}

/**
 * List Dashboards Query
 * Lists dashboards for a tenant
 */
export class ListDashboardsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly branchId?: string,
    public readonly dashboardType?: string,
    public readonly limit: number = 20,
    public readonly offset: number = 0,
  ) {}
}

/**
 * Get Analytics Report Query
 * Retrieves a single report by ID
 */
export class GetAnalyticsReportQuery {
  constructor(public readonly reportId: string, public readonly tenantId: string) {}
}

/**
 * List Analytics Reports Query
 * Lists analytics reports for a tenant
 */
export class ListAnalyticsReportsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly branchId?: string,
    public readonly reportType?: string,
    public readonly limit: number = 20,
    public readonly offset: number = 0,
  ) {}
}
