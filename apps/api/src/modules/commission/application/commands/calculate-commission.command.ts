export class CalculateCommissionCommand {
  constructor(
    public readonly providerId: string,
    public readonly branchId: string | null,
    public readonly periodStart: string,
    public readonly periodEnd: string,
    public readonly currency: string,
    public readonly basisDocumentIds: string[],
    public readonly lineItems: Array<{
      appointmentId?: string | null;
      serviceDescription: string;
      amount: number;
      serviceType?: string | null;
      commissionRateType?: 'percentage' | 'fixed_amount';
      commissionRateValue?: number;
      minimumThreshold?: number | null;
      maximumCap?: number | null;
      date: string;
    }>,
  ) {}
}
