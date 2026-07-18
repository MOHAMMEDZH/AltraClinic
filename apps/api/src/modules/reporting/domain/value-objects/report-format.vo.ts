export class ReportFormat {
  public readonly format: 'pdf' | 'csv' | 'excel';

  private constructor(format: 'pdf' | 'csv' | 'excel') {
    this.format = format;
  }

  public static pdf(): ReportFormat {
    return new ReportFormat('pdf');
  }

  public static csv(): ReportFormat {
    return new ReportFormat('csv');
  }

  public static excel(): ReportFormat {
    return new ReportFormat('excel');
  }

  public toJSON() {
    return { format: this.format };
  }
}
