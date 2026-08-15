import { ClinicalPricingUnit } from '@prisma/client';

export type PortalBookingIdempotencyComplete = {
  rowId: string;
  ownerToken: string;
  fingerprint: string;
  buildResult: (appointmentId: string) => unknown;
};

export class CreateAppointmentCommand {
  constructor(
    public readonly patientId: string,
    public readonly providerId: string,
    public readonly start: string,
    public readonly end: string,
    public readonly notes?: string,
    public readonly serviceType?: string | null,
    public readonly isEmergency?: boolean,
    public readonly recurrence?: {
      frequency: 'weekly' | 'biweekly' | 'monthly';
      occurrences: number;
    },
    public readonly resourceId?: string | null,
    /** Wave B canonical service identity */
    public readonly clinicalServiceId?: string | null,
    public readonly quantity?: number,
    public readonly pricingUnit?: ClinicalPricingUnit,
    public readonly currency?: string,
    public readonly commercialReason?: string | null,
    public readonly resourceIds?: string[],
    public readonly actorId?: string,
    /** When set, ledger COMPLETED is written in the same booking transaction (no crash duplicate window). */
    public readonly portalIdempotencyComplete?: PortalBookingIdempotencyComplete,
  ) {}
}
