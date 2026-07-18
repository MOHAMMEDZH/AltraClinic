/**
 * MetricFilters Value Object
 * Represents all filters for querying analytics metrics
 */
export interface MetricFiltersProps {
  tenantId: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  metricName?: string;
  dimensionKey?: string;
  dimensionValue?: string;
}

export class MetricFilters {
  readonly tenantId: string;
  readonly branchId: string | undefined;
  readonly startDate: string | undefined;
  readonly endDate: string | undefined;
  readonly metricName: string | undefined;
  readonly dimensionKey: string | undefined;
  readonly dimensionValue: string | undefined;

  private constructor(props: MetricFiltersProps) {
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.metricName = props.metricName;
    this.dimensionKey = props.dimensionKey;
    this.dimensionValue = props.dimensionValue;
  }

  static create(props: MetricFiltersProps): MetricFilters {
    if (!props.tenantId || !props.tenantId.trim()) {
      throw new Error('tenantId is required');
    }

    // Validate date format if provided
    if (props.startDate && isNaN(new Date(props.startDate).getTime())) {
      throw new Error('Invalid startDate format');
    }
    if (props.endDate && isNaN(new Date(props.endDate).getTime())) {
      throw new Error('Invalid endDate format');
    }

    return new MetricFilters({
      tenantId: props.tenantId.trim(),
      branchId: props.branchId?.trim(),
      startDate: props.startDate?.trim(),
      endDate: props.endDate?.trim(),
      metricName: props.metricName?.trim(),
      dimensionKey: props.dimensionKey?.trim(),
      dimensionValue: props.dimensionValue?.trim(),
    });
  }

  toJSON(): MetricFiltersProps {
    return {
      tenantId: this.tenantId,
      branchId: this.branchId,
      startDate: this.startDate,
      endDate: this.endDate,
      metricName: this.metricName,
      dimensionKey: this.dimensionKey,
      dimensionValue: this.dimensionValue,
    };
  }
}
