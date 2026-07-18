import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { FailureClass, NotificationChannelId } from './delivery.types';
import { ProviderUnavailableError } from './provider-adapter.contract';

export interface CreateDeliveryJobInput {
  tenantId: string;
  intentId: string;
  messageId: string;
  channel: NotificationChannelId;
  providerKey: string;
  scheduledAt?: Date | null;
  maxAttempts?: number;
}

export interface DeliveryJobRecord {
  id: string;
  tenantId: string;
  intentId: string;
  messageId: string;
  channel: NotificationChannelId;
  providerKey: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  scheduledAt: Date | null;
  persisted: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;

export interface RetrySchedule {
  attempt: number;
  delayMs: number;
  nextAttemptAt: Date;
}

/** Full-jitter exponential backoff: delay = random(0, min(maxDelay, base * 2^(attempt-1))). */
export function computeRetryDelay(attempt: number, now: Date = new Date()): RetrySchedule {
  const cappedExponent = Math.min(attempt - 1, 10);
  const window = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** Math.max(0, cappedExponent));
  const delayMs = Math.floor(Math.random() * window);
  return { attempt, delayMs, nextAttemptAt: new Date(now.getTime() + delayMs) };
}

/** Determines how a send failure should be handled next. */
export function classifyFailure(error: unknown, attemptCount: number, maxAttempts: number): FailureClass {
  const hinted = (error as { failureClassHint?: FailureClass } | null)?.failureClassHint;
  if (hinted === 'permanent' || hinted === 'fallback') {
    return hinted;
  }

  if (error instanceof ProviderUnavailableError) {
    return 'fallback';
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/permanent|invalid|unauthorized|forbidden|not.?found|malformed|quota/i.test(message)) {
    return 'permanent';
  }

  if (attemptCount >= maxAttempts) {
    return 'dead_letter';
  }

  return 'retryable';
}

/**
 * Owns the DeliveryJob lifecycle: creation, lease-based worker pickup, completion, retry
 * scheduling with jitter, and dead-lettering. Uses dynamic prisma access to stay compatible
 * whether or not the Phase 41d Prisma models have been generated yet.
 */
@Injectable()
export class DeliveryJobService {
  private readonly logger = new Logger(DeliveryJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  private client() {
    return this.prisma as unknown as {
      deliveryJob?: {
        create: (args: unknown) => Promise<Record<string, unknown>>;
        updateMany: (args: unknown) => Promise<{ count: number }>;
        findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };
      deliveryAttempt?: {
        create: (args: unknown) => Promise<unknown>;
      };
    };
  }

  async createJob(input: CreateDeliveryJobInput): Promise<DeliveryJobRecord> {
    const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const client = this.client();

    if (!client.deliveryJob) {
      this.logger.warn('deliveryJob Prisma model not available; returning unpersisted synthetic job');
      return {
        id: randomUUID(),
        tenantId: input.tenantId,
        intentId: input.intentId,
        messageId: input.messageId,
        channel: input.channel,
        providerKey: input.providerKey,
        status: 'pending',
        attemptCount: 0,
        maxAttempts,
        scheduledAt: input.scheduledAt ?? null,
        persisted: false,
      };
    }

    const created = await client.deliveryJob.create({
      data: {
        tenantId: input.tenantId,
        intentId: input.intentId,
        messageId: input.messageId,
        channel: input.channel,
        providerKey: input.providerKey,
        status: 'pending',
        attemptCount: 0,
        maxAttempts,
        scheduledAt: input.scheduledAt ?? null,
      },
    });

    return {
      id: created.id as string,
      tenantId: input.tenantId,
      intentId: input.intentId,
      messageId: input.messageId,
      channel: input.channel,
      providerKey: input.providerKey,
      status: 'pending',
      attemptCount: 0,
      maxAttempts,
      scheduledAt: input.scheduledAt ?? null,
      persisted: true,
    };
  }

  /** Optimistic lease: only one worker can transition pending/expired-lease → leased. */
  async leaseJob(jobId: string, leaseDurationMs = 60_000): Promise<Record<string, unknown> | null> {
    const client = this.client();
    if (!client.deliveryJob) return null;

    const now = new Date();
    const result = await client.deliveryJob.updateMany({
      where: {
        id: jobId,
        OR: [{ status: 'pending' }, { status: 'leased', leaseExpiresAt: { lt: now } }],
      },
      data: { status: 'leased', leasedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseDurationMs) },
    });

    if (result.count === 0) {
      return null;
    }
    return client.deliveryJob.findUnique({ where: { id: jobId } });
  }

  async recordAttempt(jobId: string, tenantId: string, outcome: { success: boolean; providerKey: string; error?: string; externalId?: string | null }): Promise<void> {
    const client = this.client();
    if (client.deliveryAttempt) {
      await client.deliveryAttempt.create({
        data: {
          jobId,
          tenantId,
          providerKey: outcome.providerKey,
          success: outcome.success,
          error: outcome.error ?? null,
          externalId: outcome.externalId ?? null,
          attemptedAt: new Date(),
        },
      });
    }
    if (client.deliveryJob) {
      await client.deliveryJob.update({
        where: { id: jobId },
        data: { attemptCount: { increment: 1 } },
      });
    }
  }

  async completeJob(jobId: string): Promise<void> {
    const client = this.client();
    if (!client.deliveryJob) return;
    await client.deliveryJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  /** Fails a job, classifying and either scheduling a jittered retry or dead-lettering it. */
  async failJob(job: { id: string; attemptCount: number; maxAttempts: number }, error: unknown): Promise<{ failureClass: FailureClass; retry?: RetrySchedule }> {
    const failureClass = classifyFailure(error, job.attemptCount, job.maxAttempts);
    const client = this.client();
    const message = error instanceof Error ? error.message : String(error);

    if (failureClass === 'dead_letter' || failureClass === 'permanent') {
      if (client.deliveryJob) {
        await client.deliveryJob.update({
          where: { id: job.id },
          data: { status: 'dead_letter', failureReason: message.slice(0, 500), deadLetteredAt: new Date() },
        });
      }
      return { failureClass: failureClass === 'permanent' ? 'permanent' : 'dead_letter' };
    }

    const retry = computeRetryDelay(job.attemptCount + 1);
    if (client.deliveryJob) {
      await client.deliveryJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          failureReason: message.slice(0, 500),
          scheduledAt: retry.nextAttemptAt,
        },
      });
    }
    return { failureClass, retry };
  }
}
