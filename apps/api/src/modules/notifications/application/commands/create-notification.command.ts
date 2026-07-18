export class CreateNotificationCommand {
  constructor(
    public readonly recipientId: string,
    public readonly channel: string,
    public readonly title: string,
    public readonly body: string,
    public readonly priority: 'low' | 'medium' | 'high' | 'critical',
    public readonly branchId: string | null,
  ) {}
}
