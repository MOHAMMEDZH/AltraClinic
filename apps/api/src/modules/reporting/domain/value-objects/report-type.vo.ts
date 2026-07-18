export class ReportType {
  public readonly type: 'appointment-report' | 'revenue-report' | 'patient-report' | 'compliance-report';

  private constructor(type: 'appointment-report' | 'revenue-report' | 'patient-report' | 'compliance-report') {
    this.type = type;
  }

  public static appointment(): ReportType {
    return new ReportType('appointment-report');
  }

  public static revenue(): ReportType {
    return new ReportType('revenue-report');
  }

  public static patient(): ReportType {
    return new ReportType('patient-report');
  }

  public static compliance(): ReportType {
    return new ReportType('compliance-report');
  }

  public toJSON() {
    return { type: this.type };
  }
}
