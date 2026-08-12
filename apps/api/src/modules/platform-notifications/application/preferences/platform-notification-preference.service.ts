import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../../auth/domain/value-objects/jwt-claims.vo';
import {
  MANDATORY_PREFERENCE_CATEGORIES,
  PLATFORM_NOTIFICATION_AUDIT_ACTIONS,
  PLATFORM_NOTIFICATION_PERMISSIONS,
  isPlatformNotificationFailureInjectionActive,
} from '../../platform-notifications.constants';
import type { PlatformNotificationCategory } from '../../domain/platform-notifications.types';
import {
  PlatformNotificationConflictError,
  PlatformNotificationForbiddenError,
  PlatformNotificationValidationError,
} from '../../domain/platform-notifications.errors';
import { PlatformNotificationAuditLog } from '../platform-notification-audit.log';

@Injectable()
export class PlatformNotificationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformNotificationAuditLog,
  ) {}

  async list(user: JwtClaimsVO, perms: ReadonlySet<string>, platformUserId?: string) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.preferencesView)) {
      throw new PlatformNotificationForbiddenError('Missing preferences.view');
    }
    const targetId = platformUserId ?? user.sub;
    if (
      targetId !== user.sub &&
      !perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.preferencesManage)
    ) {
      throw new PlatformNotificationForbiddenError('Cannot view other preferences');
    }
    if (isPlatformNotificationFailureInjectionActive('preference_lookup')) {
      throw new PlatformNotificationValidationError(
        'Injected preference lookup failure',
        'injected_failure',
      );
    }
    return this.prisma.withPlatformBypass((client) =>
      client.platformNotificationPreference.findMany({
        where: { platformUserId: targetId },
        orderBy: [{ category: 'asc' }, { channel: 'asc' }, { id: 'asc' }],
      }),
    );
  }

  async upsert(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: {
      platformUserId?: string;
      category: PlatformNotificationCategory;
      channel: string;
      enabled: boolean;
      locale?: string;
      expectedRowVersion?: number;
    },
    idempotencyKey: string,
  ) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.preferencesManage)) {
      throw new PlatformNotificationForbiddenError('Missing preferences.manage');
    }
    if (isPlatformNotificationFailureInjectionActive('mandatory_policy')) {
      throw new PlatformNotificationValidationError(
        'Injected mandatory policy failure',
        'injected_failure',
      );
    }
    const targetId = input.platformUserId ?? user.sub;
    if (targetId !== user.sub) {
      throw new PlatformNotificationForbiddenError('Cross-principal preference mutation denied');
    }
    if (MANDATORY_PREFERENCE_CATEGORIES.has(input.category) && input.enabled === false) {
      await this.audit.record({
        action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.MANDATORY_DISABLE_DENIED,
        resourceType: 'platform_notification_preference',
        resourceId: targetId,
        actorId: user.sub,
        result: 'denied',
        descriptionEn: 'Mandatory notification category cannot be disabled',
        descriptionAr: 'لا يمكن تعطيل فئة إشعارات إلزامية',
        details: { category: input.category, channel: input.channel },
      });
      throw new PlatformNotificationForbiddenError(
        'Mandatory notification category cannot be disabled',
      );
    }

    return this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.platformNotificationPreference.findUnique({
        where: {
          platformUserId_category_channel: {
            platformUserId: targetId,
            category: input.category,
            channel: input.channel,
          },
        },
      });
      if (
        existing &&
        input.expectedRowVersion != null &&
        existing.rowVersion !== input.expectedRowVersion
      ) {
        throw new PlatformNotificationConflictError('Stale preference rowVersion', 'occ_conflict');
      }

      const row = existing
        ? await client.platformNotificationPreference.update({
            where: { id: existing.id },
            data: {
              enabled: input.enabled,
              locale: input.locale ?? existing.locale,
              rowVersion: { increment: 1 },
            },
          })
        : await client.platformNotificationPreference.create({
            data: {
              platformUserId: targetId,
              category: input.category,
              channel: input.channel,
              enabled: input.enabled,
              locale: input.locale ?? 'en-US',
            },
          });

      await this.audit.recordInTransaction(client, {
        action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.PREFERENCE_UPDATED,
        resourceType: 'platform_notification_preference',
        resourceId: row.id,
        actorId: user.sub,
        result: 'success',
        descriptionEn: 'Platform notification preference updated',
        descriptionAr: 'تم تحديث تفضيل إشعار المنصة',
        details: {
          category: row.category,
          channel: row.channel,
          enabled: row.enabled,
          idempotencyKey,
        },
      });
      return row;
    });
  }

  async isEnabled(
    platformUserId: string,
    category: PlatformNotificationCategory,
    channel: string,
  ): Promise<boolean> {
    if (MANDATORY_PREFERENCE_CATEGORIES.has(category)) return true;
    if (isPlatformNotificationFailureInjectionActive('preference_lookup')) {
      throw new PlatformNotificationValidationError(
        'Injected preference lookup failure',
        'injected_failure',
      );
    }
    const row = await this.prisma.withPlatformBypass((client) =>
      client.platformNotificationPreference.findUnique({
        where: {
          platformUserId_category_channel: {
            platformUserId,
            category,
            channel,
          },
        },
      }),
    );
    if (!row) return true;
    return row.enabled;
  }
}
