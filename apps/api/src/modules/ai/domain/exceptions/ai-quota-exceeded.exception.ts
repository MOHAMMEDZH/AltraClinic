import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionPlanType } from '../../../subscription/domain/value-objects/subscription-plan.vo';

export type AiQuotaResource =
  | 'messages_per_day'
  | 'tokens_per_day'
  | 'requests_per_minute'
  | 'attachments'
  | 'external_providers'
  | 'workspace'
  | 'custom_prompts';

export class AiQuotaExceededException extends ForbiddenException {
  constructor(
    resource: AiQuotaResource,
    limit: number | boolean,
    plan: SubscriptionPlanType,
    extra?: Record<string, unknown>,
  ) {
    const isFlag = typeof limit === 'boolean';
    const message = isFlag
      ? `AI feature "${resource}" is not available on the "${plan}" plan.`
      : `AI quota exceeded: "${resource}" limit is ${limit} on the "${plan}" plan.`;

    super({
      statusCode: 403,
      error: 'AI Quota Exceeded',
      message,
      resource,
      limit,
      currentPlan: plan,
      upgradeRequired: true,
      ...extra,
    });
  }
}

export class AiRateLimitExceededException extends HttpException {
  constructor(retryAfterSeconds: number, plan: SubscriptionPlanType) {
    super(
      {
        statusCode: 429,
        error: 'AI Rate Limit Exceeded',
        message: 'Too many AI requests. Please wait before trying again.',
        resource: 'requests_per_minute',
        currentPlan: plan,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
