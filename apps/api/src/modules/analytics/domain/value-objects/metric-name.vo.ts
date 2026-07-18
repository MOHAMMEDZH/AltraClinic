/**
 * MetricName Value Object
 * Represents a strongly-typed metric identifier (e.g., 'appointment_no_show_rate')
 */
export class MetricName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(name: string): MetricName {
    if (!name || !name.trim()) {
      throw new Error('Metric name cannot be empty');
    }

    const normalized = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (normalized.length > 100) {
      throw new Error('Metric name too long (max 100 characters)');
    }

    return new MetricName(normalized);
  }

  static appointment_no_show_rate(): MetricName {
    return new MetricName('appointment_no_show_rate');
  }

  static appointment_utilization(): MetricName {
    return new MetricName('appointment_utilization');
  }

  static revenue_total(): MetricName {
    return new MetricName('revenue_total');
  }

  static revenue_per_visit(): MetricName {
    return new MetricName('revenue_per_visit');
  }

  static patient_count(): MetricName {
    return new MetricName('patient_count');
  }

  static patient_satisfaction(): MetricName {
    return new MetricName('patient_satisfaction');
  }

  static inventory_stockout_count(): MetricName {
    return new MetricName('inventory_stockout_count');
  }

  static staff_utilization(): MetricName {
    return new MetricName('staff_utilization');
  }

  static care_gap_closure(): MetricName {
    return new MetricName('care_gap_closure');
  }

  static guideline_adherence(): MetricName {
    return new MetricName('guideline_adherence');
  }

  equals(other: MetricName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
