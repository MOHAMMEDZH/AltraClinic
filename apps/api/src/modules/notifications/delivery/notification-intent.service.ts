import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { CANONICAL_NOTIFICATION_TYPE_IDS } from '@booking/module-registry/notification';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { IntentInput } from './delivery.types';

export interface CreatedIntent {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  status: string;
  persisted: boolean;
}

const KNOWN_TYPE_IDS: ReadonlySet<string> = new Set(CANONICAL_NOTIFICATION_TYPE_IDS as readonly string[]);

/**
 * Creates and validates `NotificationIntent` rows — the immutable "what was requested" record
 * that everything downstream (consent/prefs/quiet-hours decisions, rendered message, delivery
 * jobs) links back to. Falls back to a synthetic in-memory id (persisted=false) when the
 * Phase 41d Prisma models haven't been migrated yet, so the rest of the pipeline remains
 * exercisable end to end during incremental rollout.
 */
@Injectable()
export class NotificationIntentService {
  private readonly logger = new Logger(NotificationIntentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createIntent(input: IntentInput): Promise<CreatedIntent> {
    this.validate(input);

    const client = this.prisma as unknown as {
      notificationIntent?: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        create: (args: unknown) => Promise<{ id: string; tenantId: string; idempotencyKey: string; status: string }>;
      };
    };

    if (!client.notificationIntent) {
      this.logger.warn('notificationIntent Prisma model not available; returning unpersisted synthetic intent');
      return { id: randomUUID(), tenantId: input.tenantId, idempotencyKey: input.idempotencyKey, status: 'created', persisted: false };
    }

    const existing = await client.notificationIntent.findFirst({
      where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Duplicate idempotencyKey "${input.idempotencyKey}" already used for this tenant`);
    }

    let created: { id: string; tenantId: string; idempotencyKey: string; status: string };
    try {
      created = await client.notificationIntent.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId ?? null,
          recipientId: input.recipientId,
          recipientType: input.recipientType ?? 'user',
          notificationTypeId: input.notificationTypeId ?? null,
          category: input.category ?? null,
          transactional: input.transactional ?? true,
          priority: input.priority ?? 'medium',
          requestedChannels: input.requestedChannels,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          body: input.body,
          titleAr: input.titleAr ?? null,
          bodyAr: input.bodyAr ?? null,
          locale: input.locale ?? 'en',
          metadata: (input.metadata as never) ?? {},
          scheduledAt: input.scheduledAt ?? null,
          status: 'created',
        },
      });
    } catch (error) {
      // Race window between the findFirst check above and this create: a concurrent request
      // for the same (tenantId, idempotencyKey) can win the insert first. Prisma surfaces that
      // as a raw P2002 unique-violation, which we normalize to the same ConflictException the
      // pre-check throws so callers (e.g. dispatch idempotent-replay handling) see one shape.
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(`Duplicate idempotencyKey "${input.idempotencyKey}" already used for this tenant`);
      }
      throw error;
    }

    return { id: created.id, tenantId: created.tenantId, idempotencyKey: created.idempotencyKey, status: created.status, persisted: true };
  }

  async updateStatus(intentId: string, status: string, extra?: Record<string, unknown>): Promise<void> {
    const client = this.prisma as unknown as {
      notificationIntent?: { update: (args: unknown) => Promise<unknown> };
    };
    if (!client.notificationIntent) return;

    await client.notificationIntent.update({
      where: { id: intentId },
      data: { status, ...(extra ?? {}), updatedAt: new Date() },
    });
  }

  private validate(input: IntentInput): void {
    if (!input.tenantId?.trim()) {
      throw new BadRequestException('tenantId is required');
    }
    if (!input.recipientId?.trim()) {
      throw new BadRequestException('recipientId is required');
    }
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey is required');
    }
    if (!input.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!input.body?.trim()) {
      throw new BadRequestException('body is required');
    }
    if (!Array.isArray(input.requestedChannels) || input.requestedChannels.length === 0) {
      throw new BadRequestException('requestedChannels must be a non-empty array');
    }
    if (input.notificationTypeId && !KNOWN_TYPE_IDS.has(input.notificationTypeId)) {
      throw new BadRequestException(`Unknown notificationTypeId "${input.notificationTypeId}"; must be one of the canonical catalog type ids`);
    }
  }
}
