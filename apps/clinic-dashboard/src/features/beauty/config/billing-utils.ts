import { ApiError } from '@/lib/api-client';
import { migratePlan } from './beauty-form-utils';
import type { BeautyTreatmentPlan } from '../types/beauty.types';

export interface PlanLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type PlanBillingErrorKey =
  | 'alreadyInvoiced'
  | 'notApproved'
  | 'emptyLineItems'
  | 'invalidAmount'
  | 'noPermission';

export function buildPlanLineItems(plan: BeautyTreatmentPlan): PlanLineItem[] {
  const migrated = migratePlan(plan);
  return migrated.sessionSequence.map((step) => ({
    description: `${migrated.title} — ${step.label || step.type}`.trim(),
    quantity: 1,
    unitPrice: step.estimatedCost,
  }));
}

export function validatePlanForBilling(plan: BeautyTreatmentPlan): PlanBillingErrorKey | null {
  const migrated = migratePlan(plan);
  if (migrated.invoiceId) return 'alreadyInvoiced';
  if (migrated.status !== 'approved' && migrated.status !== 'active') return 'notApproved';
  const items = buildPlanLineItems(migrated);
  if (!items.length) return 'emptyLineItems';
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (total <= 0) return 'invalidAmount';
  if (items.some((item) => !item.description.trim() || item.unitPrice < 0)) return 'invalidAmount';
  return null;
}

export function mapBillingApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = err.message.toLowerCase();
    if (err.status === 403) {
      if (msg.includes('subscription')) return 'subscriptionRequired';
      return 'permissionDenied';
    }
    if (err.status === 404) return 'patientNotFound';
    if (err.status === 400) {
      if (msg.includes('line item')) return 'invalidLineItems';
      return 'invalidRequest';
    }
    if (err.status === 401) return 'notAuthenticated';
    return 'createFailed';
  }
  if (err instanceof Error) {
    if (err.message === 'Not authenticated') return 'notAuthenticated';
    if (err.message.toLowerCase().includes('permission')) return 'noPermission';
  }
  return 'createFailed';
}
