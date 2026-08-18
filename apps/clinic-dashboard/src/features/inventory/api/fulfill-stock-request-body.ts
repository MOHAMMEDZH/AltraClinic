export type FulfillStockRequestLineBody = {
  quantity: number;
  usedByUserId: string;
  notes?: string;
};

export const ACCOUNTABLE_STAFF_REQUIRED = 'ACCOUNTABLE_STAFF_REQUIRED';

/** Fail closed: empty/whitespace usedBy must never be serialized onto the wire. */
export function assertAccountableStaffSelected(usedByUserId: string | null | undefined): string {
  const trimmed = usedByUserId?.trim() ?? '';
  if (!trimmed) {
    throw new Error(ACCOUNTABLE_STAFF_REQUIRED);
  }
  return trimmed;
}

/**
 * Dashboard → API fulfill body. Matches `FulfillStockRequestLineDTO`.
 * `usedByUserId` must be the explicitly selected staff UUID. Callers must not
 * substitute the authenticated user, fulfiller, recorder, or request creator.
 */
export function buildFulfillStockRequestLineBody(input: {
  quantity: number;
  usedByUserId: string | null | undefined;
  notes?: string | null;
}): FulfillStockRequestLineBody {
  const body: FulfillStockRequestLineBody = {
    quantity: input.quantity,
    usedByUserId: assertAccountableStaffSelected(input.usedByUserId),
  };
  const notes = input.notes?.trim();
  if (notes) body.notes = notes;
  return body;
}
