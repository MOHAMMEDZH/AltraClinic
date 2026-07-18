import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { NotificationChannelId } from './delivery.types';

const REDACTED_PREVIEW_LENGTH = 40;

export interface CommunicationHistoryQuery {
  tenantId: string;
  recipientId?: string;
  channel?: NotificationChannelId;
  limit?: number;
  cursor?: string;
  /** Callers with an explicit compliance/audit permission may request unredacted bodies. */
  redact?: boolean;
}

export interface CommunicationAttemptView {
  success: boolean;
  providerKey: string;
  error: string | null;
  attemptedAt: Date;
}

export interface CommunicationReceiptView {
  status: string;
  externalId: string | null;
  occurredAt: Date;
}

export interface CommunicationHistoryEntry {
  intentId: string;
  messageId: string;
  jobId: string;
  channel: NotificationChannelId;
  status: string;
  title: string;
  bodyPreview: string;
  redacted: boolean;
  attempts: CommunicationAttemptView[];
  receipt: CommunicationReceiptView | null;
  createdAt: Date;
}

function redactBody(body: string): string {
  if (body.length <= REDACTED_PREVIEW_LENGTH) return body;
  return `${body.slice(0, REDACTED_PREVIEW_LENGTH)}…`;
}

/**
 * Read-side view over the delivery pipeline: joins DeliveryJob → NotificationIntent/Message →
 * DeliveryAttempt/NotificationReceipt into a single redacted-by-default history entry. Full
 * message bodies are only ever returned when `redact: false` is explicitly requested by a
 * caller that has already passed an authorization check upstream (this service does not itself
 * perform permission checks — callers are responsible for that, consistent with the rest of the
 * notifications module's controller-level guards).
 */
@Injectable()
export class CommunicationHistoryService {
  private readonly logger = new Logger(CommunicationHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private client() {
    return this.prisma as unknown as {
      deliveryJob?: { findMany: (args: unknown) => Promise<Record<string, unknown>[]>; findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
      notificationIntent?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
      notificationMessage?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
      deliveryAttempt?: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
      notificationReceipt?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    };
  }

  async list(query: CommunicationHistoryQuery): Promise<{ entries: CommunicationHistoryEntry[]; nextCursor: string | null }> {
    const client = this.client();
    if (!client.deliveryJob) {
      this.logger.warn('deliveryJob Prisma model not available; returning empty history');
      return { entries: [], nextCursor: null };
    }

    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const jobs = await client.deliveryJob.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.channel ? { channel: query.channel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = jobs.length > limit;
    const page = hasMore ? jobs.slice(0, limit) : jobs;

    const entries = await Promise.all(
      page.map((job) => this.buildEntry(job, query.redact ?? true)),
    );

    return {
      entries: entries.filter((e): e is CommunicationHistoryEntry => e !== null),
      nextCursor: hasMore ? (page[page.length - 1]?.id as string) ?? null : null,
    };
  }

  async get(jobId: string, tenantId: string, redact = true): Promise<CommunicationHistoryEntry> {
    const client = this.client();
    if (!client.deliveryJob) {
      throw new NotFoundException('Delivery job history is not available');
    }
    const job = await client.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job || job.tenantId !== tenantId) {
      throw new NotFoundException(`Delivery job "${jobId}" not found`);
    }
    const entry = await this.buildEntry(job, redact);
    if (!entry) {
      throw new NotFoundException(`Delivery job "${jobId}" is missing linked intent/message records`);
    }
    return entry;
  }

  private async buildEntry(job: Record<string, unknown>, redact: boolean): Promise<CommunicationHistoryEntry | null> {
    const client = this.client();
    const [message, attempts, receipt] = await Promise.all([
      client.notificationMessage?.findUnique({ where: { id: job.messageId } }) ?? Promise.resolve(null),
      client.deliveryAttempt?.findMany({ where: { jobId: job.id }, orderBy: { attemptedAt: 'asc' } }) ?? Promise.resolve([]),
      client.notificationReceipt?.findUnique({ where: { jobId: job.id } }) ?? Promise.resolve(null),
    ]);

    if (!message) return null;

    const body = String(message.body ?? '');

    return {
      intentId: job.intentId as string,
      messageId: job.messageId as string,
      jobId: job.id as string,
      channel: job.channel as NotificationChannelId,
      status: job.status as string,
      title: String(message.title ?? ''),
      bodyPreview: redact ? redactBody(body) : body,
      redacted: redact,
      attempts: (attempts ?? []).map((a) => ({
        success: Boolean(a.success),
        providerKey: String(a.providerKey ?? ''),
        error: (a.error as string) ?? null,
        attemptedAt: (a.attemptedAt as Date) ?? new Date(),
      })),
      receipt: receipt
        ? {
            status: String(receipt.status ?? ''),
            externalId: (receipt.externalId as string) ?? null,
            occurredAt: (receipt.occurredAt as Date) ?? new Date(),
          }
        : null,
      createdAt: (job.createdAt as Date) ?? new Date(),
    };
  }
}
