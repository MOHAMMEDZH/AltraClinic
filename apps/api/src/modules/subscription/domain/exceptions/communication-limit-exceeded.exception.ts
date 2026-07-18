import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlanType } from '../value-objects/subscription-plan.vo';

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export type CommunicationLimitPolicy = 'hard' | 'grace' | 'read_only' | 'unlimited';

/**
 * Thrown when a tenant exceeds licensed communication quota at dispatch time.
 * Machine-readable payload for clients and workers.
 */
export class CommunicationLimitExceededException extends ForbiddenException {
  constructor(params: {
    channel: CommunicationChannel;
    limit: number;
    current: number;
    plan: SubscriptionPlanType;
    policy: CommunicationLimitPolicy;
    notificationId?: string;
    warning?: boolean;
  }) {
    const message =
      params.policy === 'grace' || params.policy === 'read_only'
        ? `Communication dispatch blocked during ${params.policy} period for channel "${params.channel}".`
        : params.warning
          ? `Communication channel "${params.channel}" is at ${params.current}/${params.limit} (warning threshold).`
          : `Communication limit reached: "${params.channel}" quota is ${params.limit} on the "${params.plan}" plan.`;

    super({
      statusCode: 403,
      error: 'Communication Limit Exceeded',
      code: 'COMMUNICATION_LIMIT_EXCEEDED',
      message,
      channel: params.channel,
      limit: params.limit,
      current: params.current,
      currentPlan: params.plan,
      policy: params.policy,
      notificationId: params.notificationId ?? null,
      warning: params.warning ?? false,
      upgradeRequired: params.policy === 'hard',
    });
  }
}
