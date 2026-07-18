import { getPlanById, priceForCycle, type BillingCycleId, type SubscriptionPlanId } from '../config/subscription-config';

/** Estimates prorated charge when upgrading mid-cycle (client-side preview). */
export function estimateProration(
  currentPlanId: SubscriptionPlanId,
  targetPlanId: SubscriptionPlanId,
  billingCycle: BillingCycleId,
  daysRemainingInCycle = 15,
  daysInCycle = 30,
): number {
  const current = getPlanById(currentPlanId);
  const target = getPlanById(targetPlanId);
  const currentPrice = priceForCycle(current, billingCycle);
  const targetPrice = priceForCycle(target, billingCycle);
  const dailyDelta = (targetPrice - currentPrice) / daysInCycle;
  return Math.max(0, Math.round(dailyDelta * daysRemainingInCycle * 100) / 100);
}
