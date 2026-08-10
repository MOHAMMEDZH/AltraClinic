import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const FF_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

@Injectable()
export class FeatureFlagIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  assertValidKey(idempotencyKey: string): string {
    const key = idempotencyKey.trim();
    if (!key || !IDEMPOTENCY_KEY_REGEX.test(key)) {
      throw new BadRequestException('Invalid Idempotency-Key.');
    }
    return key;
  }

  async beginOrReplay(input: {
    actorId: string;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    table: 'flag' | 'setting';
  }): Promise<
    | {
        kind: 'replay';
        resultResourceType: string;
        resultResourceId: string;
        resultPayload?: unknown;
      }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass(async (client) => {
      if (input.table === 'flag') {
        return client.platformFeatureFlagIdempotencyRecord.findUnique({
          where: {
            actorId_operation_idempotencyKey: {
              actorId: input.actorId,
              operation: input.operation,
              idempotencyKey: key,
            },
          },
        });
      }
      return client.platformGlobalSettingIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: input.actorId,
            operation: input.operation,
            idempotencyKey: key,
          },
        },
      });
    });

    if (existing && (existing.status !== 'completed' || existing.expiresAt <= now)) {
      await this.prisma.withPlatformBypass(async (client) => {
        if (input.table === 'flag') {
          await client.platformFeatureFlagIdempotencyRecord.deleteMany({
            where: { id: existing.id },
          });
        } else {
          await client.platformGlobalSettingIdempotencyRecord.deleteMany({
            where: { id: existing.id },
          });
        }
      });
      return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash };
    }
    if (!existing) {
      return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash };
    }
    if (existing.requestHash !== input.requestHash) {
      throw new ConflictException('Idempotency key was reused with a different request.');
    }
    return {
      kind: 'replay',
      resultResourceType: existing.resultResourceType,
      resultResourceId: existing.resultResourceId,
      resultPayload: existing.resultPayload ?? undefined,
    };
  }

  async complete(
    tx: Prisma.TransactionClient,
    input: {
      table: 'flag' | 'setting';
      actorId: string;
      operation: string;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: string;
      resultResourceId: string;
      resultPayload?: unknown;
    },
  ): Promise<void> {
    const data = {
      actorId: input.actorId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      resultResourceType: input.resultResourceType,
      resultResourceId: input.resultResourceId,
      status: 'completed',
      resultPayload: input.resultPayload as never,
      expiresAt: new Date(Date.now() + FF_IDEMPOTENCY_RETENTION_MS),
    };
    if (input.table === 'flag') {
      await tx.platformFeatureFlagIdempotencyRecord.create({ data });
    } else {
      await tx.platformGlobalSettingIdempotencyRecord.create({ data });
    }
  }
}
