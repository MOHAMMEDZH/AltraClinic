import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { IDEMPOTENCY_TTL_MS } from '../usage-metering.constants';

export type UsageIdempotencyClaim =
  | { kind: 'replay'; resultResourceId: string; resultPayload: unknown }
  | { kind: 'proceed'; recordId: string };

@Injectable()
export class UsageIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  async claimCompletedOnly(
    tenantId: string,
    operation: string,
    idempotencyKey: string,
    requestHash: string,
    tx: Prisma.TransactionClient = this.prisma as unknown as Prisma.TransactionClient,
  ): Promise<UsageIdempotencyClaim> {
    const existing = await tx.platformUsageIdempotencyRecord.findUnique({
      where: {
        tenantId_operation_idempotencyKey: { tenantId, operation, idempotencyKey },
      },
    });
    if (existing) {
      if (existing.status !== 'completed') {
        throw new ConflictException('Idempotency key is in progress');
      }
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key conflict: request fingerprint mismatch');
      }
      return {
        kind: 'replay',
        resultResourceId: existing.resultResourceId,
        resultPayload: existing.resultPayload,
      };
    }
    const recordId = randomUUID();
    try {
      await tx.platformUsageIdempotencyRecord.create({
        data: {
          id: recordId,
          tenantId,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'pending',
          resultResourceId: recordId,
          status: 'claimed',
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.claimCompletedOnly(tenantId, operation, idempotencyKey, requestHash, tx);
      }
      throw err;
    }
    return { kind: 'proceed', recordId };
  }

  async complete(
    recordId: string,
    resultResourceType: string,
    resultResourceId: string,
    resultPayload: unknown,
    tx: Prisma.TransactionClient = this.prisma as unknown as Prisma.TransactionClient,
  ): Promise<void> {
    await tx.platformUsageIdempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        resultResourceType,
        resultResourceId,
        resultPayload: resultPayload as Prisma.InputJsonValue,
      },
    });
  }

  async abandon(recordId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? (this.prisma as unknown as Prisma.TransactionClient);
    await client.platformUsageIdempotencyRecord.delete({ where: { id: recordId } }).catch(() => undefined);
  }
}
