import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, NotificationChannel as PrismaChannel, NotificationStatus as PrismaStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { NOTIFICATION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { NotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { CreateNotificationHandler } from './create-notification.handler';
import {
  NOTIFICATION_AUDIT_LOG,
  NotificationAuditLog,
} from '../ports/notification-audit-log.port';
import { NotificationChannel } from '../../domain/value-objects/notification-channel.vo';
import { Notification } from '../../domain/entities/notification.entity';

const CHANNEL_MAP: Record<string, PrismaChannel> = {
  'in-app': 'IN_APP',
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
  whatsapp: 'WHATSAPP',
};

function toDto(row: {
  id: string;
  tenantId: string;
  branchId: string | null;
  recipientId: string;
  channel: PrismaChannel;
  category: string | null;
  eventType: string | null;
  templateId: string | null;
  title: string;
  body: string;
  priority: string;
  status: PrismaStatus;
  isStarred: boolean;
  isArchived: boolean;
  failureReason: string | null;
  retryCount: number;
  metadata: unknown;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    notificationId: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    recipientId: row.recipientId,
    channel: row.channel.toLowerCase().replace('_', '-'),
    category: row.category?.toLowerCase() ?? null,
    eventType: row.eventType,
    templateId: row.templateId,
    title: row.title,
    body: row.body,
    priority: row.priority.toLowerCase(),
    status: row.status.toLowerCase(),
    isStarred: row.isStarred,
    isArchived: row.isArchived,
    failureReason: row.failureReason,
    retryCount: row.retryCount,
    metadata: row.metadata,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class GetNotificationsOverviewHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(recipientId?: string) {
    const tenant = await this.tenantContext.resolve();
    const base: Prisma.NotificationWhereInput = {
      tenantId: tenant.tenantId,
      ...(recipientId ? { recipientId } : {}),
    };
    const [total, unread, failed, pending, byChannel, recentFailures] = await Promise.all([
      this.prisma.notification.count({ where: base }),
      this.prisma.notification.count({ where: { ...base, readAt: null, isArchived: false } }),
      this.prisma.notification.count({ where: { ...base, status: 'FAILED' } }),
      this.prisma.notification.count({ where: { ...base, status: 'QUEUED' } }),
      this.prisma.notification.groupBy({
        by: ['channel', 'status'],
        where: base,
        _count: { _all: true },
      }),
      this.prisma.notification.findMany({
        where: { ...base, status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          channel: true,
          failureReason: true,
          createdAt: true,
        },
      }),
    ]);
    const delivered = await this.prisma.notification.count({
      where: { ...base, status: { in: ['DELIVERED', 'READ', 'SENT'] } },
    });
    const channelPerformance = byChannel.reduce(
      (acc, row) => {
        const key = row.channel.toLowerCase();
        acc[key] = (acc[key] ?? 0) + row._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      total,
      unread,
      failed,
      pending,
      delivered,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      channelPerformance,
      recentFailures,
    };
  }
}

@Injectable()
export class ListNotificationsPaginatedHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    recipientId?: string;
    channel?: string;
    status?: string;
    category?: string;
    branchId?: string;
    unreadOnly?: boolean;
    starredOnly?: boolean;
    archivedOnly?: boolean;
    search?: string;
    limit?: number;
    cursor?: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const where: Prisma.NotificationWhereInput = {
      tenantId: tenant.tenantId,
      ...(query.recipientId ? { recipientId: query.recipientId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.unreadOnly ? { readAt: null, isArchived: false } : {}),
      ...(query.starredOnly ? { isStarred: true } : {}),
      ...(query.archivedOnly ? { isArchived: true } : { isArchived: query.archivedOnly === false ? false : undefined }),
      ...(query.status
        ? { status: query.status.toUpperCase() as PrismaStatus }
        : { status: { not: 'DRAFT' as PrismaStatus } }),
      ...(query.channel
        ? { channel: CHANNEL_MAP[query.channel.toLowerCase()] ?? 'IN_APP' }
        : {}),
      ...(query.category
        ? { category: query.category.toUpperCase() as never }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { body: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor
        ? { createdAt: { lt: new Date(query.cursor) } }
        : {}),
    };
    if (query.archivedOnly === undefined && !query.unreadOnly && !query.starredOnly) {
      where.isArchived = false;
    }
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toDto);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.createdAt ?? null : null,
    };
  }
}

@Injectable()
export class MarkAllNotificationsReadHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(recipientId: string, actorId?: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.prisma.notification.updateMany({
      where: { tenantId: tenant.tenantId, recipientId, readAt: null },
      data: { readAt: new Date(), status: 'READ', updatedAt: new Date() },
    });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.inbox.mark_all_read',
        resourceId: recipientId,
        actorId,
        actorRoles,
        descriptionEn: `Marked ${result.count} notification(s) as read`,
      });
    }
    return { updated: result.count };
  }
}

@Injectable()
export class UpdateNotificationFlagsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    notificationId: string,
    flags: { isStarred?: boolean; isArchived?: boolean },
    actorId?: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    const row = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        ...(flags.isStarred !== undefined ? { isStarred: flags.isStarred } : {}),
        ...(flags.isArchived !== undefined ? { isArchived: flags.isArchived } : {}),
        updatedAt: new Date(),
      },
    });
    if (actorId) {
      const parts: string[] = [];
      if (flags.isStarred !== undefined) parts.push(flags.isStarred ? 'starred' : 'unstarred');
      if (flags.isArchived !== undefined) parts.push(flags.isArchived ? 'archived' : 'unarchived');
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.inbox.flags_updated',
        resourceId: notificationId,
        actorId,
        actorRoles,
        descriptionEn: parts.length ? parts.join(', ') : 'Updated notification flags',
      });
    }
    return toDto(row);
  }
}

@Injectable()
export class RetryNotificationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo: NotificationRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(notificationId: string, actorId?: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const notification = await this.repo.findById(notificationId, tenant.tenantId);
    if (!notification) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'QUEUED',
        failureReason: null,
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.delivery.retried',
        resourceId: notificationId,
        actorId,
        actorRoles,
        descriptionEn: 'Retried failed notification delivery',
      });
    }
    return { notificationId, status: 'queued' };
  }
}

@Injectable()
export class DeleteNotificationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(notificationId: string, actorId?: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id: notificationId } });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.inbox.deleted',
        resourceId: notificationId,
        actorId,
        actorRoles,
        descriptionEn: `Deleted notification "${existing.title}"`,
      });
    }
    return { notificationId };
  }
}

@Injectable()
export class ExportNotificationsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    filters: { status?: string; channel?: string; limit?: number },
    actorId?: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(filters.status ? { status: filters.status.toUpperCase() as PrismaStatus } : {}),
        ...(filters.channel
          ? { channel: CHANNEL_MAP[filters.channel.toLowerCase()] ?? 'IN_APP' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 500, 2000),
    });
    const header = 'id,recipientId,channel,status,title,createdAt,sentAt,deliveredAt,failureReason';
    const lines = rows.map((r) =>
      [
        r.id,
        r.recipientId,
        r.channel,
        r.status,
        `"${r.title.replace(/"/g, '""')}"`,
        r.createdAt.toISOString(),
        r.sentAt?.toISOString() ?? '',
        r.deliveredAt?.toISOString() ?? '',
        r.failureReason ?? '',
      ].join(','),
    );
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.delivery.exported',
        resourceId: 'export',
        actorId,
        actorRoles,
        descriptionEn: `Exported ${rows.length} notification(s) to CSV`,
        details: { count: rows.length, filters },
      });
    }
    return { csv: [header, ...lines].join('\n'), count: rows.length };
  }
}

@Injectable()
export class ListNotificationTemplatesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(search?: string) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.notificationTemplate.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(search?.trim()
          ? {
              OR: [
                { name: { contains: search.trim(), mode: 'insensitive' } },
                { key: { contains: search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }
}

@Injectable()
export class CreateNotificationTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      key: string;
      name: string;
      nameAr?: string;
      channel: string;
      category?: string;
      subjectEn: string;
      subjectAr?: string;
      bodyEn: string;
      bodyAr?: string;
      variables?: string[];
    },
    createdBy: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const channel = CHANNEL_MAP[input.channel.toLowerCase()] ?? 'IN_APP';
    const row = await this.prisma.notificationTemplate.create({
      data: {
        tenantId: tenant.tenantId,
        key: input.key.trim(),
        name: input.name.trim(),
        nameAr: input.nameAr?.trim() ?? null,
        channel,
        category: (input.category?.toUpperCase() ?? 'SYSTEM') as never,
        subjectEn: input.subjectEn.trim(),
        subjectAr: input.subjectAr?.trim() ?? null,
        bodyEn: input.bodyEn.trim(),
        bodyAr: input.bodyAr?.trim() ?? null,
        variables: input.variables ?? [],
        createdBy,
        updatedBy: createdBy,
        versions: {
          create: {
            version: 1,
            subjectEn: input.subjectEn.trim(),
            subjectAr: input.subjectAr?.trim() ?? null,
            bodyEn: input.bodyEn.trim(),
            bodyAr: input.bodyAr?.trim() ?? null,
            createdBy,
          },
        },
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.template.created',
      resourceId: row.id,
      actorId: createdBy,
      actorRoles,
      descriptionEn: `Created template ${row.name}`,
    });
    return row;
  }
}

@Injectable()
export class UpdateNotificationTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    templateId: string,
    input: {
      name?: string;
      nameAr?: string;
      subjectEn?: string;
      subjectAr?: string;
      bodyEn?: string;
      bodyAr?: string;
      variables?: string[];
      isActive?: boolean;
    },
    updatedBy: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    const nextVersion = existing.version + 1;
    const row = await this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: {
        name: input.name?.trim() ?? existing.name,
        nameAr: input.nameAr?.trim() ?? existing.nameAr,
        subjectEn: input.subjectEn?.trim() ?? existing.subjectEn,
        subjectAr: input.subjectAr?.trim() ?? existing.subjectAr,
        bodyEn: input.bodyEn?.trim() ?? existing.bodyEn,
        bodyAr: input.bodyAr?.trim() ?? existing.bodyAr,
        variables: (input.variables ?? existing.variables) as Prisma.InputJsonValue,
        isActive: input.isActive ?? existing.isActive,
        version: nextVersion,
        updatedBy,
        versions: {
          create: {
            version: nextVersion,
            subjectEn: input.subjectEn?.trim() ?? existing.subjectEn,
            subjectAr: input.subjectAr?.trim() ?? existing.subjectAr,
            bodyEn: input.bodyEn?.trim() ?? existing.bodyEn,
            bodyAr: input.bodyAr?.trim() ?? existing.bodyAr,
            createdBy: updatedBy,
          },
        },
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.template.updated',
      resourceId: templateId,
      actorId: updatedBy,
      actorRoles,
      descriptionEn: `Updated template ${row.name} (v${nextVersion})`,
    });
    return row;
  }
}

@Injectable()
export class TestSendNotificationTemplateHandler {
  constructor(
    private readonly createNotification: CreateNotificationHandler,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    templateId: string,
    recipientId: string,
    variables: Record<string, string> = {},
    actorId?: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId, isActive: true },
    });
    if (!template) throw new NotFoundException('Template not found');
    let body = template.bodyEn;
    let title = template.subjectEn;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      title = title.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    const result = await this.createNotification.execute({
      recipientId,
      channel: template.channel.toLowerCase().replace('_', '-') as 'in-app',
      title,
      body,
      priority: 'medium',
      branchId: tenant.branchId ?? null,
    });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.template.test_sent',
        resourceId: templateId,
        actorId,
        actorRoles,
        descriptionEn: `Test sent template ${template.name} to recipient`,
      });
    }
    return result;
  }
}

@Injectable()
export class GetNotificationPreferencesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    let pref = await this.prisma.notificationPreference.findFirst({
      where: { tenantId: tenant.tenantId, userId },
    });
    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          tenantId: tenant.tenantId,
          userId,
          channelSettings: { inApp: true, email: true, sms: true, push: false, whatsapp: false },
          categorySettings: {},
        },
      });
    }
    return pref;
  }
}

@Injectable()
export class UpdateNotificationPreferencesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(userId: string, input: Record<string, unknown>) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notificationPreference.findFirst({
      where: { tenantId: tenant.tenantId, userId },
    });
    const row = existing
      ? await this.prisma.notificationPreference.update({
          where: { id: existing.id },
          data: {
            ...(input.channelSettings !== undefined ? { channelSettings: input.channelSettings as object } : {}),
            ...(input.categorySettings !== undefined ? { categorySettings: input.categorySettings as object } : {}),
            ...(input.quietHoursStart !== undefined ? { quietHoursStart: input.quietHoursStart as string } : {}),
            ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd as string } : {}),
            ...(input.timezone !== undefined ? { timezone: input.timezone as string } : {}),
            ...(input.language !== undefined ? { language: input.language as string } : {}),
            ...(input.frequencyLimit !== undefined ? { frequencyLimit: input.frequencyLimit as number } : {}),
          },
        })
      : await this.prisma.notificationPreference.create({
          data: {
            tenantId: tenant.tenantId,
            userId,
            channelSettings: (input.channelSettings as object) ?? {},
            categorySettings: (input.categorySettings as object) ?? {},
            quietHoursStart: (input.quietHoursStart as string) ?? null,
            quietHoursEnd: (input.quietHoursEnd as string) ?? null,
            timezone: (input.timezone as string) ?? null,
            language: (input.language as string) ?? null,
            frequencyLimit: (input.frequencyLimit as number) ?? null,
          },
        });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.preferences.updated',
      resourceId: row.id,
      actorId: userId,
      actorRoles: [],
      descriptionEn: 'Updated notification preferences',
    });
    return row;
  }
}

@Injectable()
export class GetTenantNotificationSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const channels = await this.prisma.tenantChannelConfig.findMany({
      where: { tenantId: tenant.tenantId },
    });
    const defaults: PrismaChannel[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'];
    const merged = defaults.map((channel) => {
      const row = channels.find((c) => c.channel === channel);
      return (
        row ?? {
          channel,
          isEnabled: channel === 'IN_APP' || channel === 'EMAIL',
          provider: channel === 'SMS' ? 'twilio' : channel === 'EMAIL' ? 'smtp' : null,
          providerStatus: 'unknown',
          config: {},
        }
      );
    });
    return { channels: merged };
  }
}

@Injectable()
export class UpdateTenantChannelConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    channel: string,
    input: { isEnabled?: boolean; provider?: string; providerStatus?: string; config?: Record<string, unknown> },
    actorId?: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const prismaChannel = CHANNEL_MAP[channel.toLowerCase()];
    if (!prismaChannel) throw new BadRequestException('Invalid channel');
    const row = await this.prisma.tenantChannelConfig.upsert({
      where: { tenantId_channel: { tenantId: tenant.tenantId, channel: prismaChannel } },
      create: {
        tenantId: tenant.tenantId,
        channel: prismaChannel,
        isEnabled: input.isEnabled ?? true,
        provider: input.provider ?? null,
        providerStatus: input.providerStatus ?? 'unknown',
      },
      update: {
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.providerStatus !== undefined ? { providerStatus: input.providerStatus } : {}),
        ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
      },
    });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.channels.updated',
        resourceId: prismaChannel,
        actorId,
        actorRoles,
        descriptionEn: `Updated ${channel} channel configuration`,
      });
    }
    return row;
  }
}

@Injectable()
export class ListAutomationRulesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.notificationAutomationRule.findMany({
      where: { tenantId: tenant.tenantId },
      include: { template: { select: { id: true, name: true, key: true } } },
      orderBy: { name: 'asc' },
    });
  }
}

@Injectable()
export class CreateAutomationRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      name: string;
      nameAr?: string;
      eventType: string;
      channel: string;
      templateId?: string;
      schedule?: string;
      recipientRoles?: string[];
    },
    createdBy: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.notificationAutomationRule.create({
      data: {
        tenantId: tenant.tenantId,
        name: input.name.trim(),
        nameAr: input.nameAr?.trim() ?? null,
        eventType: input.eventType.trim(),
        channel: CHANNEL_MAP[input.channel.toLowerCase()] ?? 'IN_APP',
        templateId: input.templateId ?? null,
        schedule: input.schedule?.trim() ?? null,
        recipientRoles: input.recipientRoles ?? [],
        createdBy,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.automation.created',
      resourceId: row.id,
      actorId: createdBy,
      actorRoles,
      descriptionEn: `Created automation rule ${row.name}`,
    });
    return row;
  }
}

@Injectable()
export class UpdateAutomationRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    ruleId: string,
    input: { name?: string; isActive?: boolean; templateId?: string; schedule?: string; recipientRoles?: string[] },
    actorId?: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notificationAutomationRule.findFirst({
      where: { id: ruleId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Rule not found');
    const row = await this.prisma.notificationAutomationRule.update({
      where: { id: ruleId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.schedule !== undefined ? { schedule: input.schedule } : {}),
        ...(input.recipientRoles !== undefined ? { recipientRoles: input.recipientRoles } : {}),
      },
    });
    if (actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: 'notifications.automation.updated',
        resourceId: ruleId,
        actorId,
        actorRoles,
        descriptionEn: `Updated automation rule ${row.name}`,
      });
    }
    return row;
  }
}

@Injectable()
export class ComposeNotificationHandler {
  constructor(
    private readonly createNotification: CreateNotificationHandler,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      recipientIds: string[];
      channel: string;
      title: string;
      body: string;
      priority?: string;
      templateId?: string;
      scheduledAt?: string;
      branchId?: string;
      category?: string;
      eventType?: string;
      actorId?: string;
      actorRoles?: string[];
    },
  ) {
    if (!input.recipientIds?.length) throw new BadRequestException('At least one recipient is required');
    const tenant = await this.tenantContext.resolve();
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const isFutureSchedule = scheduledAt && scheduledAt.getTime() > Date.now();
    const results = [];
    for (const recipientId of input.recipientIds) {
      const result = await this.createNotification.execute({
        recipientId,
        channel: input.channel as 'in-app',
        title: input.title,
        body: input.body,
        priority: (input.priority as 'medium') ?? 'medium',
        branchId: input.branchId ?? tenant.branchId ?? null,
      });
      await this.prisma.notification.update({
        where: { id: result.notificationId },
        data: {
          templateId: input.templateId ?? null,
          scheduledAt,
          category: input.category ? (input.category.toUpperCase() as never) : null,
          eventType: input.eventType ?? null,
        } as Prisma.NotificationUpdateInput,
      });
      results.push(result);
    }
    if (input.actorId) {
      await this.audit.record({
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        action: isFutureSchedule ? 'notifications.compose.scheduled' : 'notifications.compose.sent',
        resourceId: results[0]?.notificationId ?? 'batch',
        actorId: input.actorId,
        actorRoles: input.actorRoles ?? [],
        descriptionEn: isFutureSchedule
          ? `Scheduled ${results.length} notification(s)`
          : `Sent ${results.length} notification(s)`,
      });
    }
    return {
      sent: results.length,
      scheduled: isFutureSchedule,
      notificationIds: results.map((r) => r.notificationId),
    };
  }
}

@Injectable()
export class ListNotificationSavedFiltersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.notificationSavedFilter.findMany({
      where: { tenantId: tenant.tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Injectable()
export class SaveNotificationFilterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, name: string, filters: Record<string, unknown>) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.notificationSavedFilter.create({
      data: { tenantId: tenant.tenantId, userId, name: name.trim(), filters: filters as object },
    });
  }
}

@Injectable()
export class DeleteNotificationSavedFilterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, filterId: string) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.notificationSavedFilter.findFirst({
      where: { id: filterId, tenantId: tenant.tenantId, userId },
    });
    if (!row) throw new NotFoundException('Filter not found');
    await this.prisma.notificationSavedFilter.delete({ where: { id: filterId } });
    return { id: filterId };
  }
}

@Injectable()
export class GetUnreadNotificationCountHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(recipientId: string) {
    const tenant = await this.tenantContext.resolve();
    const count = await this.prisma.notification.count({
      where: {
        tenantId: tenant.tenantId,
        recipientId,
        readAt: null,
        isArchived: false,
      },
    });
    return { count };
  }
}

@Injectable()
export class SaveNotificationDraftHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      recipientIds: string[];
      channel: string;
      title: string;
      body: string;
      templateId?: string;
      scheduledAt?: string;
    },
    actorId: string,
    actorRoles: string[],
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.notification.create({
      data: {
        tenantId: tenant.tenantId,
        branchId: tenant.branchId ?? null,
        recipientId: actorId,
        channel: CHANNEL_MAP[input.channel.toLowerCase()] ?? 'IN_APP',
        title: input.title.trim() || 'Draft',
        body: input.body.trim() || '',
        status: 'DRAFT' as PrismaStatus,
        templateId: input.templateId ?? null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        metadata: { recipientIds: input.recipientIds } as Prisma.InputJsonValue,
      } as Prisma.NotificationUncheckedCreateInput,
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.draft.saved',
      resourceId: row.id,
      actorId,
      actorRoles,
      descriptionEn: 'Saved notification draft',
    });
    return { draftId: row.id };
  }
}

@Injectable()
export class ListNotificationDraftsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(actorId: string) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.notification.findMany({
      where: { tenantId: tenant.tenantId, recipientId: actorId, status: 'DRAFT' as PrismaStatus },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

@Injectable()
export class SendNotificationDraftHandler {
  constructor(
    private readonly compose: ComposeNotificationHandler,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(draftId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const draft = await this.prisma.notification.findFirst({
      where: { id: draftId, tenantId: tenant.tenantId, status: 'DRAFT' as PrismaStatus },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    const metadata = (draft.metadata as { recipientIds?: string[] } | null) ?? {};
    const recipientIds = metadata.recipientIds?.length ? metadata.recipientIds : [actorId];
    await this.prisma.notification.delete({ where: { id: draftId } });
    return this.compose.execute({
      recipientIds,
      channel: draft.channel.toLowerCase().replace('_', '-'),
      title: draft.title,
      body: draft.body,
      templateId: draft.templateId ?? undefined,
      scheduledAt: (draft as { scheduledAt?: Date | null }).scheduledAt?.toISOString(),
      actorId,
      actorRoles,
    });
  }
}

@Injectable()
export class DeleteNotificationTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(templateId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.notificationTemplate.delete({ where: { id: templateId } });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.template.deleted',
      resourceId: templateId,
      actorId,
      actorRoles,
      descriptionEn: `Deleted template ${existing.name}`,
    });
    return { templateId };
  }
}

@Injectable()
export class DeleteAutomationRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(ruleId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.notificationAutomationRule.findFirst({
      where: { id: ruleId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Rule not found');
    await this.prisma.notificationAutomationRule.delete({ where: { id: ruleId } });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'notifications.automation.deleted',
      resourceId: ruleId,
      actorId,
      actorRoles,
      descriptionEn: `Deleted automation rule ${existing.name}`,
    });
    return { ruleId };
  }
}

@Injectable()
export class RegisterDeviceTokenHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, input: { platform: string; token: string }) {
    const tenant = await this.tenantContext.resolve();
    return (this.prisma as unknown as { userDeviceToken: { upsert: (args: unknown) => Promise<unknown> } }).userDeviceToken.upsert({
      where: { tenantId_userId_token: { tenantId: tenant.tenantId, userId, token: input.token.trim() } },
      create: {
        tenantId: tenant.tenantId,
        userId,
        platform: input.platform.trim(),
        token: input.token.trim(),
      },
      update: { platform: input.platform.trim(), isActive: true },
    });
  }
}
