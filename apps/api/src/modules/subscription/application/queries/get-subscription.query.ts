export class GetSubscriptionQuery {
  constructor(public readonly subscriptionId: string, public readonly branchId: string | null) {}
}
