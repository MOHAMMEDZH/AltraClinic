/**
 * MetricValue Value Object
 * Represents a metric measurement with type safety (numeric, percentage, etc.)
 */
export enum MetricValueType {
  COUNT = 'count',
  PERCENTAGE = 'percentage',
  CURRENCY = 'currency',
  DURATION = 'duration', // in minutes
  RATIO = 'ratio',
  TEXT = 'text',
}

export class MetricValue {
  readonly value: number | string;
  readonly type: MetricValueType;
  readonly unit: string | null;
  readonly precision: number; // decimal places

  private constructor(value: number | string, type: MetricValueType, unit: string | null = null, precision: number = 2) {
    this.value = value;
    this.type = type;
    this.unit = unit;
    this.precision = precision;
  }

  static count(value: number): MetricValue {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Count value must be a non-negative integer');
    }
    return new MetricValue(value, MetricValueType.COUNT, null, 0);
  }

  static percentage(value: number): MetricValue {
    if (value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return new MetricValue(value, MetricValueType.PERCENTAGE, '%', 2);
  }

  static currency(value: number): MetricValue {
    if (value < 0) {
      throw new Error('Currency value cannot be negative');
    }
    return new MetricValue(value, MetricValueType.CURRENCY, 'USD', 2);
  }

  static duration(minutes: number): MetricValue {
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new Error('Duration must be a non-negative integer (minutes)');
    }
    return new MetricValue(minutes, MetricValueType.DURATION, 'min', 0);
  }

  static ratio(value: number): MetricValue {
    if (value < 0) {
      throw new Error('Ratio cannot be negative');
    }
    return new MetricValue(value, MetricValueType.RATIO, null, 2);
  }

  static text(value: string): MetricValue {
    if (!value || !value.trim()) {
      throw new Error('Text value cannot be empty');
    }
    return new MetricValue(value.trim(), MetricValueType.TEXT, null, 0);
  }

  format(): string {
    if (typeof this.value === 'string') {
      return this.value;
    }

    const rounded = this.type === MetricValueType.PERCENTAGE || this.type === MetricValueType.RATIO ? this.value.toFixed(this.precision) : this.value;

    if (this.unit) {
      return `${rounded} ${this.unit}`;
    }
    return rounded.toString();
  }

  toJSON(): { value: number | string; type: string; unit: string | null; precision: number } {
    return {
      value: this.value,
      type: this.type,
      unit: this.unit,
      precision: this.precision,
    };
  }
}
