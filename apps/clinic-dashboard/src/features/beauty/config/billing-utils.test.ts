import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { defaultTreatmentPlan, migratePlan } from './beauty-form-utils';
import { buildPlanLineItems, mapBillingApiError, validatePlanForBilling } from './billing-utils';

describe('billing-utils', () => {
  it('builds line items from approved plan sessions', () => {
    const plan = migratePlan(defaultTreatmentPlan());
    plan.title = 'Facial rejuvenation';
    plan.status = 'approved';
    const items = buildPlanLineItems(plan);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.quantity === 1 && i.unitPrice >= 0)).toBe(true);
  });

  it('rejects billing when plan is not approved', () => {
    const plan = migratePlan(defaultTreatmentPlan());
    plan.status = 'draft';
    expect(validatePlanForBilling(plan)).toBe('notApproved');
  });

  it('rejects billing when plan already has an invoice', () => {
    const plan = migratePlan(defaultTreatmentPlan());
    plan.status = 'approved';
    plan.invoiceId = 'inv-1';
    expect(validatePlanForBilling(plan)).toBe('alreadyInvoiced');
  });

  it('maps API errors to user-facing keys', () => {
    expect(mapBillingApiError(new ApiError('Forbidden', 403))).toBe('permissionDenied');
    expect(mapBillingApiError(new ApiError('Active subscription is required', 403))).toBe('subscriptionRequired');
    expect(mapBillingApiError(new ApiError('Patient not found', 404))).toBe('patientNotFound');
    expect(mapBillingApiError(new ApiError('Line item quantity must be greater than zero', 400))).toBe(
      'invalidLineItems',
    );
    expect(mapBillingApiError(new Error('Not authenticated'))).toBe('notAuthenticated');
    expect(mapBillingApiError(new Error('Billing permission required'))).toBe('noPermission');
  });
});
