export class ListNotificationsCommand {
  constructor(
    public readonly recipientId: string | null,
    public readonly channel: string | null,
    public readonly status: string | null,
    public readonly branchId: string | null,
  ) {}
}
