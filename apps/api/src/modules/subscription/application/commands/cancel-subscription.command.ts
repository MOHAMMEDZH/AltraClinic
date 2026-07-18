export class CancelSubscriptionCommand {
  constructor(public readonly subscriptionId: string, public readonly canceledBy: string) {}
}
