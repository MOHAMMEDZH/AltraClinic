import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

export type PlanIdempotencyOperation =
  | 'plan.create'
  | 'plan.createDraftVersion'
  | 'plan.cloneVersion'
  | 'plan.publishVersion'
  | 'plan.createAlias'
  | 'plan.replaceEntitlements'
  | 'plan.applyRequiredDeps'
  | 'plan.replaceLimits';

export type PlanIdempotencyResourceType = 'plan' | 'planVersion' | 'planAlias';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const PLAN_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Bounded winner-reload defaults (fixed delay; no busy loop; no DB-lock details). */
export const PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS = 25;
export const PLAN_IDEMPOTENCY_REPLAY_DELAY_MS = 20;
/** maxAttempts × delayMs ≈ 500ms wall clock excluding query time. */
export const PLAN_IDEMPOTENCY_REPLAY_MAX_DURATION_MS =
  PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS * PLAN_IDEMPOTENCY_REPLAY_DELAY_MS;

/** Thrown inside a mutation transaction when an equivalent completed row already won the race. */
export class IdempotencyEquivalentRaceLostError extends Error {
  readonly resultResourceType: PlanIdempotencyResourceType;
  readonly resultResourceId: string;

  constructor(resultResourceType: PlanIdempotencyResourceType, resultResourceId: string) {
    super('Equivalent idempotency race lost — reload original result.');
    this.name = 'IdempotencyEquivalentRaceLostError';
    this.resultResourceType = resultResourceType;
    this.resultResourceId = resultResourceId;
  }
}

/**
 * Bounded winner-reload timed out before a completed equivalent row was visible.
 * Safe retryable outcome — never reported as conflicting reuse (409 different fingerprint).
 */
export class IdempotencyEquivalentReplayTimeoutError extends Error {
  constructor() {
    super('Equivalent idempotent result is not yet available; retry shortly.');
    this.name = 'IdempotencyEquivalentReplayTimeoutError';
  }
}

/**
 * Step 14 durable idempotency — Option A: completed-only atomic model.
 *
 * Persisted state: only `status=completed` rows are meaningful.
 * Mutation and completed-row insert commit in the same transaction.
 * Failure / crash-before-commit leaves no idempotency row.
 * Equivalent uniqueness losers reload the winning completed result (never 409).
 */
@Injectable()
export class PlanIdempotencyService {
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
    operation: PlanIdempotencyOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | { kind: 'replay'; resultResourceType: PlanIdempotencyResourceType; resultResourceId: string }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformPlanIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: input.actorId,
            operation: input.operation,
            idempotencyKey: key,
          },
        },
      }),
    );

    // Option A: only completed, unexpired rows are durable outcomes.
    // Orphan non-completed / expired rows are removed so a new attempt can proceed.
    if (existing && (existing.status !== 'completed' || existing.expiresAt <= now)) {
      await this.prisma.withPlatformBypass((client) =>
        client.platformPlanIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
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
      resultResourceType: existing.resultResourceType as PlanIdempotencyResourceType,
      resultResourceId: existing.resultResourceId,
    };
  }

  /**
   * Bounded poll for a completed equivalent result after losing a uniqueness/OCC race.
   * No durable in-progress state exists; wait only for a concurrent winner to commit.
   */
  async awaitEquivalentReplay(
    input: {
      actorId: string;
      operation: PlanIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
    },
    opts: { maxAttempts?: number; delayMs?: number } = {},
  ): Promise<{
    resultResourceType: PlanIdempotencyResourceType;
    resultResourceId: string;
  } | null> {
    const maxAttempts = opts.maxAttempts ?? PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS;
    const delayMs = opts.delayMs ?? PLAN_IDEMPOTENCY_REPLAY_DELAY_MS;
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
      operation: PlanIdempotencyOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: PlanIdempotencyResourceType;
      resultResourceId: string;
    },
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + PLAN_IDEMPOTENCY_RETENTION_MS);

    // INSERT … ON CONFLICT DO NOTHING avoids aborting the interactive transaction (P2002).
    await client.$executeRaw`
      INSERT INTO platform_plan_idempotency (
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

    const row = await client.platformPlanIdempotencyRecord.findUnique({
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
      // Equivalent winner already committed — roll back this mutation TX, then outer replay.
      throw new IdempotencyEquivalentRaceLostError(
        row.resultResourceType as PlanIdempotencyResourceType,
        row.resultResourceId,
      );
    }
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.prisma.withPlatformBypass((client) =>
      client.platformPlanIdempotencyRecord.deleteMany({ where: expiresAtLte(now) }),
    );
    return result.count;
  }
}

function expiresAtLte(now: Date) {
  return { expiresAt: { lte: now } };
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
