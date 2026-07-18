/**
 * Base Analytics Domain Exception
 * All analytics domain exceptions inherit from this
 */
export class AnalyticsDomainException extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export class MetricNotFoundError extends AnalyticsDomainException {
  constructor(metricId: string) {
    super('METRIC_NOT_FOUND', `Metric with ID ${metricId} not found`);
  }
}

export class DashboardNotFoundError extends AnalyticsDomainException {
  constructor(dashboardId: string) {
    super('DASHBOARD_NOT_FOUND', `Dashboard with ID ${dashboardId} not found`);
  }
}

export class ReportNotFoundError extends AnalyticsDomainException {
  constructor(reportId: string) {
    super('REPORT_NOT_FOUND', `Report with ID ${reportId} not found`);
  }
}

export class InvalidMetricDefinitionError extends AnalyticsDomainException {
  constructor(reason: string) {
    super('INVALID_METRIC_DEFINITION', `Invalid metric definition: ${reason}`);
  }
}

export class UnauthorizedAnalyticsAccessError extends AnalyticsDomainException {
  constructor(reason: string) {
    super('UNAUTHORIZED_ACCESS', `Unauthorized analytics access: ${reason}`);
  }
}

export class AnalyticsDataIntegrityError extends AnalyticsDomainException {
  constructor(reason: string) {
    super('DATA_INTEGRITY_ERROR', `Analytics data integrity error: ${reason}`);
  }
}

export class MetricLimitExceededError extends AnalyticsDomainException {
  constructor(reason: string) {
    super('METRIC_LIMIT_EXCEEDED', `Metric limit exceeded: ${reason}`);
  }
}
