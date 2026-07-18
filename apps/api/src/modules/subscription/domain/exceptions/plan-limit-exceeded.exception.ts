import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlanType } from '../value-objects/subscription-plan.vo';

export type LimitedResource =
  | 'users'
  | 'doctors'
  | 'branches'
  | 'patients'
  | 'appointments_per_month'
  | 'reports_per_month'
  | 'storage_gb'
  | 'api_requests_per_day'
  | 'email_per_month'
  | 'sms_per_month'
  | 'whatsapp_per_month'
  | 'push_per_month';

export type FeatureName = keyof import('../config/plan-limits.config').PlanFeatures;

/**
 * Thrown when a tenant tries to exceed their plan quota or use a feature
 * not included in their subscription plan.
 *
 * Returns HTTP 403 Forbidden with a structured payload so clients can
 * surface a meaningful upgrade prompt.
 */
export class PlanLimitExceededException extends ForbiddenException {
  constructor(resource: string, limit: number | boolean, plan: SubscriptionPlanType) {
    const isFeature = typeof limit === 'boolean';
    const message = isFeature
      ? `Feature "${resource}" is not available on the "${plan}" plan. Upgrade to access this feature.`
      : `Plan limit reached: "${resource}" limit is ${limit} on the "${plan}" plan. Upgrade to increase your limit.`;

    super({
      statusCode: 403,
      error: 'Plan Limit Exceeded',
      message,
      resource,
      limit,
      currentPlan: plan,
      upgradeRequired: true,
    });
  }
}
