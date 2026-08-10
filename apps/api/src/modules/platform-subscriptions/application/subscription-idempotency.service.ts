import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

/**
 * Durable Step 16 mutation keys.
 *
 * Concurrent exact-duplicate protection uses an in-transaction unique claim
 * (`claimInTransaction`) before business mutation. Fast-path `beginOrReplay`
 * remains completed-row replay only (no completed row → proceed into the tx claim).
 *
 * Not implemented:
 * - subscription.expire — EXPIRED lifecycle exists; no explicit expire mutation route
 */
export type SubscriptionIdempotencyOperation =
  | 'subscription.create'
  | 'subscription.update'
  | 'subscription.assignPlanVersion'
  | 'subscription.replaceAddOns'
  | 'subscription.replaceOverrides'
  | 'subscription.updateDates'
  | 'subscription.activate'
  | 'subscription.schedule'
  | 'subscription.suspend'
  | 'subscription.resume'
  | 'subscription.cancel'
  | 'subscription.supersede'
  | 'subscription.renew';

export type SubscriptionIdempotencyResourceType = 'subscriptionCommercialConfig';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const SUBSCRIPTION_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS = 25;
export const SUBSCRIPTION_IDEMPOTENCY_REPLAY_DELAY_MS = 20;

export class SubscriptionIdempotencyEquivalentRaceLostError extends Error {
  readonly resultResourceType: SubscriptionIdempotencyResourceType;
  readonly resultResourceId: string;

  constructor(resultResourceType: SubscriptionIdempotencyResourceType, resultResourceId: string) {
    super('Equivalent idempotency race lost — reload original result.');
    this.name = 'SubscriptionIdempotencyEquivalentRaceLostError';
    this.resultResourceType = resultResourceType;
    this.resultResourceId = resultResourceId;
  }
}

@Injectable()
export class SubscriptionIdempotencyService {
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
    operation: SubscriptionIdempotencyOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | {
        kind: 'replay';
        resultResourceType: SubscriptionIdempotencyResourceType;
        resultResourceId: string;
      }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialIdempotencyRecord.findUnique({
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
        client.platformSubscriptionCommercialIdempotencyRecord.deleteMany({
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
      resultResourceType: existing.resultResourceType as SubscriptionIdempotencyResourceType,
      resultResourceId: existing.resultResourceId,
    };
  }

  async awaitEquivalentReplay(input: {
    actorId: string;
    operation: SubscriptionIdempotencyOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{
    resultResourceType: SubscriptionIdempotencyResourceType;
    resultResourceId: string;
  } | null> {
    for (let attempt = 0; attempt < SUBSCRIPTION_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS; attempt++) {
      const gate = await this.beginOrReplay(input);
      if (gate.kind === 'replay') {
        return {
          resultResourceType: gate.resultResourceType,
          resultResourceId: gate.resultResourceId,
        };
      }
      if (attempt < SUBSCRIPTION_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS - 1) {
        await sleep(SUBSCRIPTION_IDEMPOTENCY_REPLAY_DELAY_MS);
      }
    }
    return null;
  }

  /**
   * Deterministic unique claim inside the business transaction (before mutation).
   * Winner: INSERT completed claim row.
   * Loser: blocks on the unique index until the winner commits/rolls back, then
   * throws RaceLost (same hash) or ConflictException (conflicting payload).
   * Rollback of the winner transaction also rolls back the claim.
   */
  async claimInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: SubscriptionIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: SubscriptionIdempotencyResourceType;
      resultResourceId: string;
    },
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + SUBSCRIPTION_IDEMPOTENCY_RETENTION_MS);

    const inserted = await client.$queryRaw<Array<{ id: string }>>`
      INSERT INTO platform_subscription_commercial_idempotency (
        id, "actorId", operation, "idempotencyKey", "requestHash",
        "resultResourceType", "resultResourceId", status, "createdAt", "expiresAt"
      ) VALUES (
        gen_random_uuid(),
        ${input.actorId}::uuid,
        ${input.operation},
        ${key},
        ${input.requestHash},
        ${input.resultResourceType},
        ${input.resultResourceId}::uuid,
        'completed',
        NOW(),
        ${expiresAt}
      )
      ON CONFLICT ("actorId", operation, "idempotencyKey") DO NOTHING
      RETURNING id
    `;

    if (inserted.length === 1) {
      return;
    }

    const row = await client.platformSubscriptionCommercialIdempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
        },
      },
    });
    if (!row || row.status !== 'completed') {
      throw new ConflictException('Idempotency claim could not be acquired.');
    }
    if (row.requestHash !== input.requestHash) {
      throw new ConflictException('Idempotency key was reused with a different request.');
    }
    throw new SubscriptionIdempotencyEquivalentRaceLostError(
      row.resultResourceType as SubscriptionIdempotencyResourceType,
      row.resultResourceId,
    );
  }

  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: SubscriptionIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: SubscriptionIdempotencyResourceType;
      resultResourceId: string;
    },
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + SUBSCRIPTION_IDEMPOTENCY_RETENTION_MS);

    await client.$executeRaw`
      INSERT INTO platform_subscription_commercial_idempotency (
        id, "actorId", operation, "idempotencyKey", "requestHash",
        "resultResourceType", "resultResourceId", status, "createdAt", "expiresAt"
      ) VALUES (
        gen_random_uuid(),
        ${input.actorId}::uuid,
        ${input.operation},
        ${key},
        ${input.requestHash},
        ${input.resultResourceType},
        ${input.resultResourceId}::uuid,
        'completed',
        NOW(),
        ${expiresAt}
      )
      ON CONFLICT ("actorId", operation, "idempotencyKey") DO NOTHING
    `;

    const row = await client.platformSubscriptionCommercialIdempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
        },
      },
    });
    if (!row || row.status !== 'completed') {
      throw new ConflictException('Idempotency record could not be completed.');
    }
    if (row.requestHash !== input.requestHash) {
      throw new ConflictException('Idempotency key was reused with a different request.');
    }
    if (row.resultResourceId !== input.resultResourceId) {
      throw new SubscriptionIdempotencyEquivalentRaceLostError(
        row.resultResourceType as SubscriptionIdempotencyResourceType,
        row.resultResourceId,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}
