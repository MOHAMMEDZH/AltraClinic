/**
 * TimeRange Value Object
 * Represents a time period for analytics queries with validation
 */
export enum TimeGranularity {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export class TimeRange {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly granularity: TimeGranularity;

  private constructor(startDate: Date, endDate: Date, granularity: TimeGranularity) {
    this.startDate = startDate;
    this.endDate = endDate;
    this.granularity = granularity;
  }

  static create(startDate: string | Date, endDate: string | Date, granularity: TimeGranularity = TimeGranularity.DAILY): TimeRange {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    if (isNaN(start.getTime())) {
      throw new Error('Invalid start date');
    }
    if (isNaN(end.getTime())) {
      throw new Error('Invalid end date');
    }
    if (start > end) {
      throw new Error('Start date cannot be after end date');
    }

    // Enforce max time range: 2 years
    const maxRange = 2 * 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      throw new Error('Time range cannot exceed 2 years');
    }

    return new TimeRange(start, end, granularity);
  }

  static last24Hours(granularity: TimeGranularity = TimeGranularity.HOURLY): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return new TimeRange(start, end, granularity);
  }

  static lastWeek(granularity: TimeGranularity = TimeGranularity.DAILY): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new TimeRange(start, end, granularity);
  }

  static lastMonth(granularity: TimeGranularity = TimeGranularity.DAILY): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return new TimeRange(start, end, granularity);
  }

  static lastQuarter(granularity: TimeGranularity = TimeGranularity.WEEKLY): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    return new TimeRange(start, end, granularity);
  }

  static lastYear(granularity: TimeGranularity = TimeGranularity.MONTHLY): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    return new TimeRange(start, end, granularity);
  }

  getDurationInDays(): number {
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  toJSON(): { startDate: string; endDate: string; granularity: string } {
    return {
      startDate: this.startDate.toISOString(),
      endDate: this.endDate.toISOString(),
      granularity: this.granularity,
    };
  }
}
