import { randomUUID } from 'crypto';

/**
 * DashboardWidget Value Object
 * Represents a single widget/card in a dashboard
 */
export interface DashboardWidgetConfig {
  widgetId: string;
  metricName: string;
  title: string;
  description?: string;
  position: number; // order in dashboard
  size: 'small' | 'medium' | 'large'; // UI sizing
  chartType: 'number' | 'line' | 'bar' | 'pie' | 'table';
  refreshInterval?: number; // seconds (null = no auto-refresh)
  dimensionFilters?: Record<string, string>;
}

/**
 * Dashboard Aggregate Root
 * Represents a saved dashboard configuration
 * Examples: "Operational Dashboard", "Financial Dashboard", "Medical Quality Dashboard"
 */
export interface DashboardProps {
  tenantId: string;
  branchId?: string;
  name: string;
  description?: string;
  dashboardType: 'executive' | 'operational' | 'clinical' | 'financial' | 'inventory' | 'custom';
  widgets: DashboardWidgetConfig[];
  createdBy: string;
  isDefault?: boolean;
  isPublic?: boolean;
}

export class Dashboard {
  public readonly dashboardId: string;
  public readonly tenantId: string;
  public readonly branchId: string | undefined;
  public name: string;
  public description: string | undefined;
  public readonly dashboardType: 'executive' | 'operational' | 'clinical' | 'financial' | 'inventory' | 'custom';
  public widgets: DashboardWidgetConfig[];
  public readonly createdBy: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public isDefault: boolean;
  public isPublic: boolean; // Can other users in tenant view this?
  public favoriteCount: number;

  private constructor(props: DashboardProps) {
    this.dashboardId = randomUUID();
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.name = props.name;
    this.description = props.description;
    this.dashboardType = props.dashboardType;
    this.widgets = props.widgets;
    this.createdBy = props.createdBy;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDefault = props.isDefault ?? false;
    this.isPublic = props.isPublic ?? false;
    this.favoriteCount = 0;
  }

  static create(props: DashboardProps): Dashboard {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId is required');
    }
    if (!props.name?.trim()) {
      throw new Error('Dashboard name is required');
    }
    if (!props.dashboardType) {
      throw new Error('Dashboard type is required');
    }
    if (!Array.isArray(props.widgets) || props.widgets.length === 0) {
      throw new Error('Dashboard must have at least one widget');
    }
    if (!props.createdBy?.trim()) {
      throw new Error('createdBy is required');
    }

    return new Dashboard(props);
  }

  static rehydrate(
    row: DashboardProps & {
      dashboardId: string;
      createdAt: Date;
      updatedAt: Date;
      favoriteCount?: number;
    },
  ): Dashboard {
    return Object.assign(Object.create(Dashboard.prototype), {
      dashboardId: row.dashboardId,
      tenantId: row.tenantId,
      branchId: row.branchId,
      name: row.name,
      description: row.description,
      dashboardType: row.dashboardType,
      widgets: row.widgets,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isDefault: row.isDefault ?? false,
      isPublic: row.isPublic ?? false,
      favoriteCount: row.favoriteCount ?? 0,
    }) as Dashboard;
  }

  /**
   * Add widget to dashboard
   */
  addWidget(widget: DashboardWidgetConfig): void {
    if (this.widgets.length >= 20) {
      throw new Error('Dashboard cannot have more than 20 widgets');
    }

    // Ensure unique positions
    const maxPosition = Math.max(0, ...this.widgets.map((w) => w.position));
    this.widgets.push({
      ...widget,
      position: widget.position ?? maxPosition + 1,
    });
    this.updatedAt = new Date();
  }

  /**
   * Remove widget by ID
   */
  removeWidget(widgetId: string): void {
    const before = this.widgets.length;
    this.widgets = this.widgets.filter((w) => w.widgetId !== widgetId);
    if (this.widgets.length < before) {
      this.updatedAt = new Date();
    }
  }

  /**
   * Update dashboard metadata
   */
  update(name: string, description?: string): void {
    if (!name?.trim()) {
      throw new Error('Dashboard name cannot be empty');
    }
    this.name = name.trim();
    this.description = description?.trim() ?? undefined;
    this.updatedAt = new Date();
  }

  /**
   * Mark as default dashboard for this dashboard type
   */
  markAsDefault(): void {
    this.isDefault = true;
    this.updatedAt = new Date();
  }

  /**
   * Toggle public visibility
   */
  togglePublic(): void {
    this.isPublic = !this.isPublic;
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      dashboardId: this.dashboardId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      name: this.name,
      description: this.description,
      dashboardType: this.dashboardType,
      widgets: this.widgets,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDefault: this.isDefault,
      isPublic: this.isPublic,
      favoriteCount: this.favoriteCount,
    };
  }
}
