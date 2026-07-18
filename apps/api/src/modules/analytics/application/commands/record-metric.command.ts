/**
 * Record Metric Command
 * Records a new metric data point
 */
export class RecordMetricCommand {
  constructor(
    public readonly tenantId: string,
    public readonly metricName: string,
    public readonly metricValue: number | string,
    public readonly recordedBy: string,
    public readonly timestamp?: string,
    public readonly branchId?: string,
    public readonly dimensions?: Record<string, string>,
    public readonly tags?: Record<string, string>,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
