import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { OpsConsoleError, type OpsActionResult } from '../domain/operations-console.types';
import { OPERATIONS_CONSOLE_ACTIONS } from '../platform-operations-console.constants';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const OPS_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const OPS_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS = 80;
export const OPS_IDEMPOTENCY_REPLAY_DELAY_MS = 25;
const PENDING_STALE_MS = 2 * 60 * 1000;

export type OpsDurableOperation =
  | typeof OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY
  | typeof OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE;

export class OpsIdempotencyEquivalentRaceLostError extends Error {
  constructor(
    readonly resultResourceType: string,
    readonly resultResourceId: string,
    readonly resultPayload?: unknown,
  ) {
    super('Equivalent ops idempotency race lost — reload original result.');
    this.name = 'OpsIdempotencyEquivalentRaceLostError';
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

/**
 * Flexible Step 22 — PostgreSQL durable ops claim/result store (Model D-B).
 * Authoritative for Operations Console HTTP exact-replay / conflict / audit cardinality.
 * Process-local Map in OpsIdempotencyService is a non-authoritative optimization only.
 *
 * Claim ordering: pending row is inserted BEFORE the material source effect; completed
 * payload is written after success. Concurrent losers await the completed replay.
 */
@Injectable()
export class OpsDurableIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  assertValidKey(idempotencyKey: string): string {
    const key = idempotencyKey.trim();
    if (!key || !IDEMPOTENCY_KEY_REGEX.test(key)) {
      throw new OpsConsoleError('idempotency_required', 'Invalid Idempotency-Key', 400);
    }
    return key;
  }

  /**
   * Atomically claim a pending row before material work, or return a completed replay.
   */
  async claimOrReplay(input: {
    actorId: string;
    operation: OpsDurableOperation;
    idempotencyKey: string;
    requestHash: string;
    resultResourceType: string;
    resultResourceId: string;
  }): Promise<
    | { kind: 'replay'; result: OpsActionResult }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string; claimId: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const expiresAt = new Date(Date.now() + OPS_IDEMPOTENCY_RETENTION_MS);

    for (let attempt = 0; attempt < OPS_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS; attempt++) {
      const existing = await this.prisma.withPlatformBypass((client) =>
        client.platformOperationsIdempotencyRecord.findUnique({
          where: {
            actorId_operation_idempotencyKey: {
              actorId: input.actorId,
              operation: input.operation,
              idempotencyKey: key,
            },
          },
        }),
      );

      if (existing) {
        if (existing.requestHash !== input.requestHash) {
          throw new OpsConsoleError(
            'idempotency_conflict',
            'Idempotency-Key conflicts with a prior claim',
            409,
          );
        }
        if (existing.status === 'completed' && existing.expiresAt > now) {
          return { kind: 'replay', result: this.payloadToResult(existing.resultPayload) };
        }
        if (existing.status === 'pending') {
          const ageMs = now.getTime() - existing.createdAt.getTime();
          if (ageMs < PENDING_STALE_MS) {
            await sleep(OPS_IDEMPOTENCY_REPLAY_DELAY_MS);
            continue;
          }
          // Stale pending from a crashed peer — reclaim.
          await this.prisma.withPlatformBypass((client) =>
            client.platformOperationsIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
          );
        } else if (existing.expiresAt <= now || existing.status !== 'completed') {
          await this.prisma.withPlatformBypass((client) =>
            client.platformOperationsIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
          );
        }
      }

      const claimId = randomUUID();
      const inserted = await this.prisma.withPlatformBypass((client) =>
        client.$queryRaw<Array<{ id: string }>>`
          INSERT INTO platform_operations_idempotency (
            id, "actorId", operation, "idempotencyKey", "requestHash",
            "resultResourceType", "resultResourceId", status, "resultPayload", "createdAt", "expiresAt"
          ) VALUES (
            ${claimId}::uuid,
            ${input.actorId}::uuid,
            ${input.operation},
            ${key},
            ${input.requestHash},
            ${input.resultResourceType},
            ${input.resultResourceId}::uuid,
            'pending',
            NULL,
            NOW(),
            ${expiresAt}
          )
          ON CONFLICT ("actorId", operation, "idempotencyKey") DO NOTHING
          RETURNING id
        `,
      );

      if (inserted.length === 1) {
        return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash, claimId };
      }
      await sleep(OPS_IDEMPOTENCY_REPLAY_DELAY_MS);
    }

    throw new OpsConsoleError(
      'idempotency_conflict',
      'Idempotency claim could not be acquired',
      409,
    );
  }

  /** Backward-compatible read path used by tests/helpers — completed rows only. */
  async beginOrReplay(input: {
    actorId: string;
    operation: OpsDurableOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | { kind: 'replay'; result: OpsActionResult }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.platformOperationsIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: input.actorId,
            operation: input.operation,
            idempotencyKey: key,
          },
        },
      }),
    );

    if (!existing) {
      return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash };
    }
    if (existing.requestHash !== input.requestHash) {
      throw new OpsConsoleError(
        'idempotency_conflict',
        'Idempotency-Key conflicts with a prior claim',
        409,
      );
    }
    if (existing.status === 'completed' && existing.expiresAt > now) {
      return { kind: 'replay', result: this.payloadToResult(existing.resultPayload) };
    }
    return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash };
  }

  async awaitEquivalentReplay(input: {
    actorId: string;
    operation: OpsDurableOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<OpsActionResult | null> {
    for (let attempt = 0; attempt < OPS_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS; attempt++) {
      const gate = await this.beginOrReplay(input);
      if (gate.kind === 'replay') return gate.result;
      if (attempt < OPS_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS - 1) {
        await sleep(OPS_IDEMPOTENCY_REPLAY_DELAY_MS);
      }
    }
    return null;
  }

  async releasePendingClaim(input: {
    actorId: string;
    operation: OpsDurableOperation;
    idempotencyKey: string;
  }): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    await this.prisma.withPlatformBypass((client) =>
      client.platformOperationsIdempotencyRecord.deleteMany({
        where: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
          status: 'pending',
        },
      }),
    );
  }

  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: OpsDurableOperation;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: string;
      resultResourceId: string;
      result: OpsActionResult;
    },
  ): Promise<'completed'> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + OPS_IDEMPOTENCY_RETENTION_MS);
    const payload = input.result as unknown as Prisma.InputJsonValue;

    const updated = await client.$queryRaw<Array<{ id: string }>>`
      UPDATE platform_operations_idempotency
      SET
        status = 'completed',
        "resultPayload" = ${payload}::jsonb,
        "resultResourceType" = ${input.resultResourceType},
        "resultResourceId" = ${input.resultResourceId}::uuid,
        "requestHash" = ${input.requestHash},
        "expiresAt" = ${expiresAt}
      WHERE "actorId" = ${input.actorId}::uuid
        AND operation = ${input.operation}
        AND "idempotencyKey" = ${key}
        AND status = 'pending'
      RETURNING id
    `;

    if (updated.length === 1) return 'completed';

    // Fallback insert for callers that did not take a pending claim (legacy).
    const inserted = await client.$queryRaw<Array<{ id: string }>>`
      INSERT INTO platform_operations_idempotency (
        id, "actorId", operation, "idempotencyKey", "requestHash",
        "resultResourceType", "resultResourceId", status, "resultPayload", "createdAt", "expiresAt"
      ) VALUES (
        ${randomUUID()}::uuid,
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
      RETURNING id
    `;

    if (inserted.length === 1) return 'completed';

    const row = await client.platformOperationsIdempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
        },
      },
    });
    if (!row || row.status !== 'completed') {
      throw new OpsConsoleError('idempotency_conflict', 'Idempotency claim could not be acquired', 409);
    }
    if (row.requestHash !== input.requestHash) {
      throw new OpsConsoleError(
        'idempotency_conflict',
        'Idempotency-Key conflicts with a prior claim',
        409,
      );
    }
    throw new OpsIdempotencyEquivalentRaceLostError(
      row.resultResourceType,
      row.resultResourceId,
      row.resultPayload,
    );
  }

  payloadToResult(payload: unknown): OpsActionResult {
    const p = payload as OpsActionResult | null;
    if (!p || typeof p !== 'object' || typeof p.action !== 'string') {
      throw new OpsConsoleError('idempotency_conflict', 'Durable claim missing result payload', 409);
    }
    return {
      accepted: Boolean(p.accepted),
      replayed: true,
      action: p.action,
      targetId: String(p.targetId),
      correlationId: String(p.correlationId),
      result: String(p.result ?? 'accepted'),
      sourceEffect: String(p.sourceEffect ?? ''),
    };
  }
}
