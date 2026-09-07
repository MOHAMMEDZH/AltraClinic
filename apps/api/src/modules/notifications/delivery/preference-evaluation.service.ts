import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { NotificationChannelId, PreferenceDecision, PreferenceSnapshot } from './delivery.types';

const CHANNEL_TO_SETTINGS_KEY: Record<NotificationChannelId, string> = {
  'in-app': 'inApp',
  email: 'email',
  sms: 'sms',
  whatsapp: 'whatsapp',
  push: 'push',
  webhook: 'webhook',
};

export interface LoadPreferenceInput {
  tenantId: string;
  recipientId: string;
  recipientType?: 'user' | 'patient' | 'platform_user';
}

export interface EvaluatePreferenceInput {
  requestedChannels: NotificationChannelId[];
  category?: string | null;
  transactional: boolean;
  /** Whether the notification type's policy allows transactional messages to override an
   * otherwise-disabled channel/category preference. Defaults to true for transactional. */
  allowTransactionalOverride?: boolean;
  snapshot: PreferenceSnapshot;
}

const EMPTY_SNAPSHOT: PreferenceSnapshot = {
  found: false,
  channelSettings: {},
  categorySettings: {},
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: null,
  language: null,
  promotionalOptIn: false,
  optedOut: false,
};

function asBooleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

/**
 * Loads and evaluates `NotificationPreference` rows. Fail-open on missing rows (no preference
 * on file means nothing has been explicitly disabled), but never fail-open on consent — that
 * remains ConsentEvaluationService's job. Uses dynamic prisma access (`(this.prisma as any)`)
 * per Phase 41d integration notes so this compiles regardless of Prisma client generation order.
 */
@Injectable()
export class PreferenceEvaluationService {
  private readonly logger = new Logger(PreferenceEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async loadPreference(input: LoadPreferenceInput): Promise<PreferenceSnapshot> {
    const recipientType = input.recipientType ?? 'user';
    // Step 27 platform principals use platform_notification_preferences (evaluated upstream).
    if (recipientType === 'platform_user') {
      return EMPTY_SNAPSHOT;
    }
    try {
      const client = this.prisma as unknown as {
        notificationPreference?: {
          findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        };
      };
      if (!client.notificationPreference) {
        return EMPTY_SNAPSHOT;
      }

      const where =
        recipientType === 'patient'
          ? { tenantId: input.tenantId, patientId: input.recipientId }
          : { tenantId: input.tenantId, userId: input.recipientId };

      const row = await client.notificationPreference.findFirst({ where });
      if (!row) {
        return EMPTY_SNAPSHOT;
      }

      const channelSettings = asBooleanMap(row.channelSettings);
      const categorySettings = asBooleanMap(row.categorySettings);

      return {
        found: true,
        channelSettings,
        categorySettings,
        quietHoursStart: typeof row.quietHoursStart === 'string' ? row.quietHoursStart : null,
        quietHoursEnd: typeof row.quietHoursEnd === 'string' ? row.quietHoursEnd : null,
        timezone: typeof row.timezone === 'string' ? row.timezone : null,
        language: typeof row.language === 'string' ? row.language : null,
        promotionalOptIn: channelSettings.promotionalOptIn === true || categorySettings.promotionalOptIn === true,
        optedOut: channelSettings.optedOut === true || categorySettings.optedOut === true,
      };
    } catch (error) {
      this.logger.warn(`Failed to load notification preference: ${error instanceof Error ? error.message : String(error)}`);
      return EMPTY_SNAPSHOT;
    }
  }

  evaluate(input: EvaluatePreferenceInput): PreferenceDecision {
    const allowTransactionalOverride = input.allowTransactionalOverride ?? true;
    const allowed: NotificationChannelId[] = [];
    const blocked: { channel: NotificationChannelId; reason: string }[] = [];

    for (const channel of input.requestedChannels) {
      const settingsKey = CHANNEL_TO_SETTINGS_KEY[channel];
      const explicitlyDisabled = input.snapshot.channelSettings[settingsKey] === false;
      const categoryDisabled = input.category ? input.snapshot.categorySettings[input.category] === false : false;

      if (!explicitlyDisabled && !categoryDisabled) {
        allowed.push(channel);
        continue;
      }

      if (input.transactional && allowTransactionalOverride) {
        allowed.push(channel);
        continue;
      }

      const reasonParts: string[] = [];
      if (explicitlyDisabled) reasonParts.push(`channel "${channel}" disabled by preference`);
      if (categoryDisabled) reasonParts.push(`category "${input.category}" disabled by preference`);
      blocked.push({ channel, reason: reasonParts.join('; ') });
    }

    return {
      allowedChannels: allowed,
      blockedChannels: blocked,
      reason:
        blocked.length === 0
          ? 'all requested channels permitted by preference'
          : `${blocked.length} channel(s) blocked by preference`,
      snapshot: input.snapshot,
    };
  }
}
