export class ReportStatus {
  public readonly status: 'queued' | 'generating' | 'completed' | 'failed';

  private constructor(status: 'queued' | 'generating' | 'completed' | 'failed') {
    this.status = status;
  }

  public static queued(): ReportStatus {
    return new ReportStatus('queued');
  }

  public static generating(): ReportStatus {
    return new ReportStatus('generating');
  }

  public static completed(): ReportStatus {
    return new ReportStatus('completed');
  }

  public static failed(): ReportStatus {
    return new ReportStatus('failed');
  }

  public isGeneratingOrLater(): boolean {
    return this.status === 'generating' || this.status === 'completed' || this.status === 'failed';
  }

  public toJSON() {
    return { status: this.status };
  }
}
