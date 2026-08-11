import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { SalesLeadError } from '../domain/sales-lead.errors';
import { SALES_LEAD_IDEMPOTENCY_RETENTION_MS } from '../platform-sales-leads.constants';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
const REPLAY_MAX_ATTEMPTS = 80;
const REPLAY_DELAY_MS = 25;
const PENDING_STALE_MS = 2 * 60 * 1000;

export type LeadActionResult = {
  accepted: boolean;
  replayed: boolean;
  action: string;
  targetId: string;
  correlationId: string;
  result: string;
};

export class LeadIdempotencyEquivalentRaceLostError extends Error {
  constructor(
    readonly resultResourceType: string,
    readonly resultResourceId: string,
    readonly resultPayload?: unknown,
  ) {
    super('Equivalent lead idempotency race lost — reload original result.');
    this.name = 'LeadIdempotencyEquivalentRaceLostError';
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
 * Flexible Step 24 — durable claim/result store for sales lead mutations.
 * Reuses platform_sales_idempotency with operation namespace sales_lead.*.
 */
@Injectable()
export class LeadDurableIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  assertValidKey(idempotencyKey: string): string {
    const key = (idempotencyKey ?? '').trim();
    if (!key || !IDEMPOTENCY_KEY_REGEX.test(key)) {
      throw new SalesLeadError('idempotency_required', 'Invalid Idempotency-Key', 400);
    }
    return key;
  }

  async claimOrReplay(input: {
    actorId: string;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    resultResourceType: string;
    resultResourceId: string;
  }): Promise<
    | { kind: 'replay'; result: LeadActionResult }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string; claimId: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const expiresAt = new Date(Date.now() + SALES_LEAD_IDEMPOTENCY_RETENTION_MS);

    for (let attempt = 0; attempt < REPLAY_MAX_ATTEMPTS; attempt++) {
      const existing = await this.prisma.withPlatformBypass((client) =>
        client.platformSalesIdempotencyRecord.findUnique({
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
          throw new SalesLeadError('idempotency_conflict', 'Idempotency-Key conflicts with a prior claim', 409);
        }
        if (existing.status === 'completed' && existing.expiresAt > now) {
          return { kind: 'replay', result: this.payloadToResult(existing.resultPayload) };
        }
        if (existing.status === 'pending') {
          const ageMs = now.getTime() - existing.createdAt.getTime();
          if (ageMs < PENDING_STALE_MS) {
            await sleep(REPLAY_DELAY_MS);
            continue;
          }
          await this.prisma.withPlatformBypass((client) =>
            client.platformSalesIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
          );
        } else if (existing.expiresAt <= now || existing.status !== 'completed') {
          await this.prisma.withPlatformBypass((client) =>
            client.platformSalesIdempotencyRecord.deleteMany({ where: { id: existing.id } }),
          );
        }
      }

      const claimId = randomUUID();
      const inserted = await this.prisma.withPlatformBypass((client) =>
        client.$queryRaw<Array<{ id: string }>>`
          INSERT INTO platform_sales_idempotency (
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
      await sleep(REPLAY_DELAY_MS);
    }

    throw new SalesLeadError('idempotency_conflict', 'Idempotency claim could not be acquired', 409);
  }

  async releasePendingClaim(input: { actorId: string; operation: string; idempotencyKey: string }): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    await this.prisma.withPlatformBypass((client) =>
      client.platformSalesIdempotencyRecord.deleteMany({
        where: { actorId: input.actorId, operation: input.operation, idempotencyKey: key, status: 'pending' },
      }),
    );
  }

  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: {
      actorId: string;
      operation: string;
      idempotencyKey: string;
      requestHash: string;
      resultResourceType: string;
      resultResourceId: string;
      result: LeadActionResult;
    },
  ): Promise<'completed'> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + SALES_LEAD_IDEMPOTENCY_RETENTION_MS);
    const payload = input.result as unknown as Prisma.InputJsonValue;

    const updated = await client.$queryRaw<Array<{ id: string }>>`
      UPDATE platform_sales_idempotency
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

    const inserted = await client.$queryRaw<Array<{ id: string }>>`
      INSERT INTO platform_sales_idempotency (
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

    const row = await client.platformSalesIdempotencyRecord.findUnique({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
        },
      },
    });
    if (!row || row.status !== 'completed') {
      throw new SalesLeadError('idempotency_conflict', 'Idempotency claim could not be acquired', 409);
    }
    if (row.requestHash !== input.requestHash) {
      throw new SalesLeadError('idempotency_conflict', 'Idempotency-Key conflicts with a prior claim', 409);
    }
    throw new LeadIdempotencyEquivalentRaceLostError(row.resultResourceType, row.resultResourceId, row.resultPayload);
  }

  payloadToResult(payload: unknown): LeadActionResult {
    const p = payload as LeadActionResult | null;
    if (!p || typeof p !== 'object' || typeof p.action !== 'string') {
      throw new SalesLeadError('idempotency_conflict', 'Durable claim missing result payload', 409);
    }
    return {
      accepted: Boolean(p.accepted),
      replayed: true,
      action: p.action,
      targetId: String(p.targetId),
      correlationId: String(p.correlationId),
      result: String(p.result ?? 'accepted'),
    };
  }
}
