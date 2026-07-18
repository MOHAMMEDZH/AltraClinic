import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

/** Ordered so a numeric comparison tells us whether a new status is a forward transition. */
export const RECEIPT_STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 0,
};

export interface UpsertReceiptInput {
  tenantId: string;
  jobId: string;
  channel: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  externalId?: string | null;
  raw?: unknown;
  occurredAt?: Date;
}

export interface UpsertReceiptResult {
  applied: boolean;
  reason: string;
  status: string;
}

/**
 * Idempotent receipt upserts keyed by jobId. Enforces monotonic status progression so a
 * late/duplicate/out-of-order provider webhook can never regress a receipt — e.g. once
 * DELIVERED is recorded, a stale SENT callback arriving afterwards is a no-op, not a downgrade.
 * FAILED is treated as terminal-but-not-ranked: it never overwrites a prior success status.
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  private client() {
    return this.prisma as unknown as {
      notificationReceipt?: {
        findUnique: (args: unknown) => Promise<{ id: string; status: string } | null>;
        create: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
      };
    };
  }

  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertReceiptInput): Promise<UpsertReceiptResult> {
    const client = this.client();
    if (!client.notificationReceipt) {
      this.logger.warn('notificationReceipt Prisma model not available; skipping persistence');
      return { applied: false, reason: 'receipt model unavailable', status: input.status };
    }

    const existing = await client.notificationReceipt.findUnique({ where: { jobId: input.jobId } });

    if (!existing) {
      await client.notificationReceipt.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          jobId: input.jobId,
          channel: input.channel,
          status: input.status,
          externalId: input.externalId ?? null,
          raw: (input.raw as never) ?? undefined,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
      return { applied: true, reason: 'created', status: input.status };
    }

    if (!this.isForwardTransition(existing.status, input.status)) {
      return { applied: false, reason: `stale transition ${existing.status} -> ${input.status} ignored`, status: existing.status };
    }

    await client.notificationReceipt.update({
      where: { jobId: input.jobId },
      data: {
        status: input.status,
        externalId: input.externalId ?? null,
        raw: (input.raw as never) ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
    return { applied: true, reason: 'updated', status: input.status };
  }

  private isForwardTransition(fromStatus: string, toStatus: string): boolean {
    if (fromStatus === toStatus) return true;
    if (toStatus === 'FAILED') {
      // FAILED can only apply before any success has been recorded.
      return !(fromStatus in RECEIPT_STATUS_RANK) || RECEIPT_STATUS_RANK[fromStatus] <= RECEIPT_STATUS_RANK.QUEUED;
    }
    const fromRank = RECEIPT_STATUS_RANK[fromStatus] ?? -1;
    const toRank = RECEIPT_STATUS_RANK[toStatus] ?? -1;
    return toRank > fromRank;
  }
}
