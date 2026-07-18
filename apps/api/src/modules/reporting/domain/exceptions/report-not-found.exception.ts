export class ReportNotFoundException extends Error {
  constructor(reportId: string) {
    super(`Report with id ${reportId} not found`);
    this.name = 'ReportNotFoundException';
  }
}
