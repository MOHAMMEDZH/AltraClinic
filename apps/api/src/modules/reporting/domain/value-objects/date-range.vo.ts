export class DateRange {
  public readonly start: Date;
  public readonly end: Date;

  private constructor(start: Date, end: Date) {
    this.start = start;
    this.end = end;
  }

  public static create(start: string, end: string): DateRange {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error('start date must be valid ISO date string');
    }
    if (Number.isNaN(endDate.getTime())) {
      throw new Error('end date must be valid ISO date string');
    }
    if (endDate < startDate) {
      throw new Error('end date must be equal to or after start date');
    }

    return new DateRange(startDate, endDate);
  }

  public toJSON() {
    return {
      start: this.start.toISOString(),
      end: this.end.toISOString(),
    };
  }
}
