import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

/**
 * Durable Step 15 mutation keys (completed-only).
 *
 * Not implemented (no external handler — do not invent ops):
 * - addon.reactivate — ARCHIVED→ACTIVE uses addon.activate; no separate route
 * - addon.updateDraftVersion — no PATCH draft-version metadata endpoint
 * - override.replaceEffects — effects are part of override.updateDraft
 * - override.expire — no expire mutation endpoint
 */
export type AddonIdempotencyOperation =
  | 'addon.create'
  | 'addon.update'
  | 'addon.activate'
  | 'addon.archive'
  | 'addon.createDraftVersion'
  | 'addon.replaceEntitlements'
  | 'addon.replaceLimitEffects'
  | 'addon.replaceApplicability'
  | 'addon.cloneVersion'
  | 'addon.publishVersion'
  | 'addon.retireVersion'
  | 'override.create'
  | 'override.updateDraft'
  | 'override.submit'
  | 'override.approve'
  | 'override.reject'
  | 'override.revoke'
  | 'override.supersede';

export type AddonIdempotencyResourceType = 'addOn' | 'addOnVersion' | 'override';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const ADDON_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const ADDON_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS = 25;
export const ADDON_IDEMPOTENCY_REPLAY_DELAY_MS = 20;
export const ADDON_IDEMPOTENCY_REPLAY_MAX_DURATION_MS =
  ADDON_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS * ADDON_IDEMPOTENCY_REPLAY_DELAY_MS;

export class IdempotencyEquivalentRaceLostError extends Error {
  readonly resultResourceType: AddonIdempotencyResourceType;
  readonly resultResourceId: string;

  constructor(resultResourceType: AddonIdempotencyResourceType, resultResourceId: string) {
    super('Equivalent idempotency race lost — reload original result.');
    this.name = 'IdempotencyEquivalentRaceLostError';
    this.resultResourceType = resultResourceType;
    this.resultResourceId = resultResourceId;
  }
}

export class IdempotencyEquivalentReplayTimeoutError extends Error {
  constructor() {
    super('Equivalent idempotent result is not yet available; retry shortly.');
    this.name = 'IdempotencyEquivalentReplayTimeoutError';
  }
}

/**
 * Step 15 durable idempotency — Option A: completed-only atomic model.
 * Same contract as PlanIdempotencyService; separate table/bounded context.
 */
@Injectable()
export class AddonIdempotencyService {
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
    operation: AddonIdempotencyOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | { kind: 'replay'; resultResourceType: AddonIdempotencyResourceType; resultResourceId: string }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformCommercialIdempotencyRecord.findUnique({
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
        client.platformCommercialIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
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
      resultResourceType: existing.resultResourceType as AddonIdempotencyResourceType,
      resultResourceId: existing.resultResourceId,
    };
  }

  async awaitEquivalentReplay(
    input: {
      actorId: string;
      operation: AddonIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
    },
    opts: { maxAttempts?: number; delayMs?: number } = {},
  ): Promise<{
    resultResourceType: AddonIdempotencyResourceType;
    resultResourceId: string;
  } | null> {
    const maxAttempts = opts.maxAttempts ?? ADDON_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS;
    const delayMs = opts.delayMs ?? ADDON_IDEMPOTENCY_REPLAY_DELAY_MS;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const gate = await this.beginOrReplay(input);
      if (gate.kind === 'replay') {
        return {
          resultResourceType: gate.resultResourceType,
          resultResourceId: gate.resultResourceId,
        };
      }
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }
    return null;
  }

  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: AddonIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: AddonIdempotencyResourceType;
      resultResourceId: string;
    },
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + ADDON_IDEMPOTENCY_RETENTION_MS);

    await client.$executeRaw`
      INSERT INTO platform_commercial_idempotency (
        id,
        "actorId",
        operation,
        "idempotencyKey",
        "requestHash",
        "resultResourceType",
        "resultResourceId",
        status,
        "createdAt",
        "expiresAt"
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

    const row = await client.platformCommercialIdempotencyRecord.findUnique({
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
      throw new IdempotencyEquivalentRaceLostError(
        row.resultResourceType as AddonIdempotencyResourceType,
        row.resultResourceId,
      );
    }
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.prisma.withPlatformBypass((client) =>
      client.platformCommercialIdempotencyRecord.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    );
    return result.count;
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
