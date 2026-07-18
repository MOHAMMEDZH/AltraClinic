/**
 * Generate Analytics Report Command
 * Generates an exportable analytics report
 */
export class GenerateAnalyticsReportCommand {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
    public readonly reportType: 'operational' | 'clinical' | 'financial' | 'inventory' | 'executive' | 'custom',
    public readonly format: 'pdf' | 'excel' | 'csv' | 'json',
    public readonly createdBy: string,
    public readonly description?: string,
    public readonly branchId?: string,
    public readonly parameters?: Record<string, unknown>,
    public readonly recipientEmails?: string[],
    public readonly isScheduled?: boolean,
    public readonly scheduleFrequency?: 'daily' | 'weekly' | 'monthly',
  ) {}
}
