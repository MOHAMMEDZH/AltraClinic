import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { ProvisioningOperation } from '../domain/tenant-provisioning.types';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const PROVISIONING_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const PROVISIONING_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS = 200;
export const PROVISIONING_IDEMPOTENCY_REPLAY_DELAY_MS = 200;

export type ProvisioningIdempotencyResourceType = 'provisioningRequest';

export class ProvisioningIdempotencyEquivalentRaceLostError extends Error {
  readonly resultResourceType: ProvisioningIdempotencyResourceType;
  readonly resultResourceId: string;

  constructor(resultResourceType: ProvisioningIdempotencyResourceType, resultResourceId: string) {
    super('Equivalent idempotency race lost — reload original result.');
    this.name = 'ProvisioningIdempotencyEquivalentRaceLostError';
    this.resultResourceType = resultResourceType;
    this.resultResourceId = resultResourceId;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

@Injectable()
export class ProvisioningIdempotencyService {
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
    operation: ProvisioningOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | {
        kind: 'replay';
        resultResourceType: ProvisioningIdempotencyResourceType;
        resultResourceId: string;
        resultPayload?: unknown;
      }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformTenantProvisioningIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: input.actorId,
            operation: input.operation,
            idempotencyKey: key,
          },
        },
      }),
    );

    if (existing && (existing.status !== 'completed' || existing.expiresAt <= now)) {
      await this.prisma.withPlatformBypass((client) =>
        client.platformTenantProvisioningIdempotencyRecord.deleteMany({
          where: { id: existing.id },
        }),
      );
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
      resultResourceType: existing.resultResourceType as ProvisioningIdempotencyResourceType,
      resultResourceId: existing.resultResourceId,
      resultPayload: existing.resultPayload ?? undefined,
    };
  }

  async awaitEquivalentReplay(input: {
    actorId: string;
    operation: ProvisioningOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{
    resultResourceType: ProvisioningIdempotencyResourceType;
    resultResourceId: string;
    resultPayload?: unknown;
  } | null> {
    for (let attempt = 0; attempt < PROVISIONING_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS; attempt++) {
      const gate = await this.beginOrReplay(input);
      if (gate.kind === 'replay') {
        return {
          resultResourceType: gate.resultResourceType,
          resultResourceId: gate.resultResourceId,
          resultPayload: gate.resultPayload,
        };
      }
      if (attempt < PROVISIONING_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS - 1) {
        await sleep(PROVISIONING_IDEMPOTENCY_REPLAY_DELAY_MS);
      }
    }
    return null;
  }

  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: ProvisioningOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: ProvisioningIdempotencyResourceType;
      resultResourceId: string;
      resultPayload?: unknown;
    },
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + PROVISIONING_IDEMPOTENCY_RETENTION_MS);
    const payload = input.resultPayload === undefined ? null : input.resultPayload;

    await client.$executeRaw`
      INSERT INTO platform_tenant_provisioning_idempotency (
        id, "actorId", operation, "idempotencyKey", "requestHash",
        "resultResourceType", "resultResourceId", status, "resultPayload", "createdAt", "expiresAt"
      ) VALUES (
        gen_random_uuid(),
        ${input.actorId}::uuid,
        ${input.operation},
        ${key},
        ${input.requestHash},
        ${input.resultResourceType},
        ${input.resultResourceId}::uuid,
        'completed',
        ${payload}::jsonb,
        NOW(),
        ${expiresAt}
      )
      ON CONFLICT ("actorId", operation, "idempotencyKey") DO NOTHING
    `;
  }
}
