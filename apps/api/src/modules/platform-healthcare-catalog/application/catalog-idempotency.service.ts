import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';

export type CatalogIdempotencyOperation = 'catalog.createItem' | 'catalog.createRule';
export type CatalogIdempotencyResourceType = 'item' | 'rule';

export interface CatalogIdempotencyCompleteInput {
  actorId: string;
  operation: CatalogIdempotencyOperation;
  idempotencyKey: string;
  requestHash: string;
  resultResourceType: CatalogIdempotencyResourceType;
  resultResourceId: string;
}

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
/** Retention window for durable replay protection. */
export const CATALOG_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Durable PostgreSQL Catalog mutation idempotency (create item / create rule).
 *
 * Scope: actorId + operation + idempotencyKey (unique).
 * Stores request SHA-256 hash + result resource identity only.
 * Never stores raw request bodies, tokens, session IDs, or translation text.
 */
@Injectable()
export class CatalogIdempotencyService {
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
    operation: CatalogIdempotencyOperation;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | { kind: 'replay'; resultResourceType: CatalogIdempotencyResourceType; resultResourceId: string }
    | { kind: 'proceed'; idempotencyKey: string; requestHash: string }
  > {
    const key = this.assertValidKey(input.idempotencyKey);
    const now = new Date();
    const existing = await this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: input.actorId,
            operation: input.operation,
            idempotencyKey: key,
          },
        },
      }),
    );

    if (!existing || existing.expiresAt <= now || existing.status !== 'completed') {
      return { kind: 'proceed', idempotencyKey: key, requestHash: input.requestHash };
    }
    if (existing.requestHash !== input.requestHash) {
      throw new ConflictException('Idempotency key was reused with a different request.');
    }
    return {
      kind: 'replay',
      resultResourceType: existing.resultResourceType as CatalogIdempotencyResourceType,
      resultResourceId: existing.resultResourceId,
    };
  }

  /** Persist inside an open Catalog transaction (preferred — atomic with create). */
  async completeInTransaction(
    client: Prisma.TransactionClient,
    input: CatalogIdempotencyCompleteInput,
  ): Promise<void> {
    const key = this.assertValidKey(input.idempotencyKey);
    const expiresAt = new Date(Date.now() + CATALOG_IDEMPOTENCY_RETENTION_MS);
    try {
      await client.healthcareCatalogIdempotencyRecord.create({
        data: {
          actorId: input.actorId,
          operation: input.operation,
          idempotencyKey: key,
          requestHash: input.requestHash,
          resultResourceType: input.resultResourceType,
          resultResourceId: input.resultResourceId,
          status: 'completed',
          expiresAt,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await client.healthcareCatalogIdempotencyRecord.findUnique({
          where: {
            actorId_operation_idempotencyKey: {
              actorId: input.actorId,
              operation: input.operation,
              idempotencyKey: key,
            },
          },
        });
        if (existing && existing.requestHash === input.requestHash) {
          return;
        }
        throw new ConflictException('Idempotency key was reused with a different request.');
      }
      throw err;
    }
  }

  /**
   * Operational retention cleanup — deletes only expired rows.
   * Bounded delete; does not run inside create transactions.
   * No automatic scheduler in Step 12; invoke via ops/job when needed.
   */
  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogIdempotencyRecord.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    );
    return result.count;
  }
}

/** Deterministic JSON for hashing — sorts object keys; excludes undefined. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}
