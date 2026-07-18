/**
 * Create Dashboard Command
 * Creates a new analytics dashboard
 */
export interface DashboardWidgetInput {
  metricName: string;
  title: string;
  description?: string;
  position: number;
  size: 'small' | 'medium' | 'large';
  chartType: 'number' | 'line' | 'bar' | 'pie' | 'table';
  refreshInterval?: number;
  dimensionFilters?: Record<string, string>;
}

export class CreateDashboardCommand {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
    public readonly dashboardType: 'executive' | 'operational' | 'clinical' | 'financial' | 'inventory' | 'custom',
    public readonly createdBy: string,
    public readonly widgets: DashboardWidgetInput[],
    public readonly description?: string,
    public readonly branchId?: string,
    public readonly isDefault?: boolean,
    public readonly isPublic?: boolean,
  ) {}
}
