import { createHash, randomUUID } from 'crypto';
import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';

export type PortalIdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface PortalIdempotencyRecord {
  fingerprint: string;
  status: PortalIdempotencyStatus;
  result: unknown;
  createdAt: number;
  expiresAt: number;
  attemptVersion: number;
  ownerToken: string;
}

const STALE_MS = 5 * 60 * 1000;

/**
 * Wave B PA — DB-backed portal scheduling idempotency ledger with CAS ownership.
 * Falls back to process-local Map only when PrismaService is absent (unit tests).
 */
@Injectable()
export class PortalSchedulingIdempotencyService {
  private readonly memory = new Map<string, PortalIdempotencyRecord & { id: string }>();

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
  }

  async beginOrReplay(input: {
    tenantId: string;
    patientId: string;
    operation: string;
    idempotencyKey: string;
    fingerprint: string;
  }): Promise<
    | { kind: 'replay'; result: unknown }
    | { kind: 'proceed'; storageKey: string; rowId: string; ownerToken: string; attemptVersion: number }
  > {
    const storageKey = `${input.tenantId}:${input.patientId}:${input.operation}:${input.idempotencyKey}`;
    const now = Date.now();

    if (!this.prisma) {
      const existing = this.memory.get(storageKey);
      if (!existing) {
        const id = randomUUID();
        const ownerToken = randomUUID();
        this.memory.set(storageKey, {
          id,
          fingerprint: input.fingerprint,
          status: 'IN_PROGRESS',
          result: null,
          createdAt: now,
          expiresAt: now + STALE_MS,
          attemptVersion: 0,
          ownerToken,
        });
        return { kind: 'proceed', storageKey, rowId: id, ownerToken, attemptVersion: 0 };
      }
      if (existing.fingerprint !== input.fingerprint) {
        throw new ConflictException({
          statusCode: 409,
          code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
          message: 'Idempotency key was reused with a different request',
          error: 'Conflict',
        });
      }
      if (existing.status === 'COMPLETED' && existing.result != null) {
        return { kind: 'replay', result: existing.result };
      }
      if (
        existing.status === 'FAILED' ||
        (existing.status === 'IN_PROGRESS' && existing.expiresAt <= now)
      ) {
        const ownerToken = randomUUID();
        const nextVersion = existing.attemptVersion + 1;
        // CAS: only one reclaim wins if version matches.
        if (this.memory.get(storageKey)?.attemptVersion !== existing.attemptVersion) {
          throw new ConflictException({
            statusCode: 409,
            code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
            message: 'Idempotency key contention; retry',
            error: 'Conflict',
          });
        }
        this.memory.set(storageKey, {
          ...existing,
          fingerprint: input.fingerprint,
          status: 'IN_PROGRESS',
          result: null,
          createdAt: now,
          expiresAt: now + STALE_MS,
          attemptVersion: nextVersion,
          ownerToken,
        });
        return {
          kind: 'proceed',
          storageKey,
          rowId: existing.id,
          ownerToken,
          attemptVersion: nextVersion,
        };
      }
      throw new ConflictException({
        statusCode: 409,
        code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
        message: 'Idempotency key contention; retry',
        error: 'Conflict',
      });
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const ownerToken = randomUUID();
        const created = await this.prisma.withPlatformBypass((c) =>
          c.portalSchedulingIdempotencyLedger.create({
            data: {
              id: randomUUID(),
              tenantId: input.tenantId,
              patientId: input.patientId,
              operation: input.operation,
              idempotencyKey: input.idempotencyKey,
              fingerprint: input.fingerprint,
              status: 'IN_PROGRESS',
              responseJson: Prisma.JsonNull,
              expiresAt: new Date(now + STALE_MS),
              attemptVersion: BigInt(0),
              ownerToken,
            },
          }),
        );
        return {
          kind: 'proceed',
          storageKey,
          rowId: created.id,
          ownerToken,
          attemptVersion: 0,
        };
      } catch (err) {
        if (
          !(err instanceof Prisma.PrismaClientKnownRequestError) ||
          err.code !== 'P2002'
        ) {
          throw err;
        }
        const existing = await this.prisma.withPlatformBypass((c) =>
          c.portalSchedulingIdempotencyLedger.findUnique({
            where: {
              tenantId_patientId_operation_idempotencyKey: {
                tenantId: input.tenantId,
                patientId: input.patientId,
                operation: input.operation,
                idempotencyKey: input.idempotencyKey,
              },
            },
          }),
        );
        if (!existing) continue;
        if (existing.fingerprint !== input.fingerprint) {
          throw new ConflictException({
            statusCode: 409,
            code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
            message: 'Idempotency key was reused with a different request',
            error: 'Conflict',
          });
        }
        if (existing.status === 'COMPLETED' && existing.responseJson != null) {
          return { kind: 'replay', result: existing.responseJson };
        }
        const expired =
          existing.status === 'FAILED' ||
          (existing.status === 'IN_PROGRESS' &&
            existing.expiresAt != null &&
            existing.expiresAt.getTime() <= now) ||
          (existing.status === 'IN_PROGRESS' &&
            existing.expiresAt == null &&
            existing.createdAt.getTime() + STALE_MS <= now);
        if (expired) {
          const ownerToken = randomUUID();
          const priorVersion = existing.attemptVersion ?? BigInt(0);
          const reclaimed = await this.prisma.withPlatformBypass((c) =>
            c.portalSchedulingIdempotencyLedger.updateMany({
              where: {
                id: existing.id,
                attemptVersion: priorVersion,
                OR: [
                  { status: 'FAILED' },
                  {
                    status: 'IN_PROGRESS',
                    expiresAt: { lte: new Date(now) },
                  },
                  {
                    status: 'IN_PROGRESS',
                    expiresAt: null,
                    createdAt: { lte: new Date(now - STALE_MS) },
                  },
                ],
              },
              data: {
                fingerprint: input.fingerprint,
                status: 'IN_PROGRESS',
                responseJson: Prisma.JsonNull,
                expiresAt: new Date(now + STALE_MS),
                completedAt: null,
                attemptVersion: priorVersion + BigInt(1),
                ownerToken,
                updatedAt: new Date(),
              },
            }),
          );
          if (reclaimed.count === 1) {
            return {
              kind: 'proceed',
              storageKey,
              rowId: existing.id,
              ownerToken,
              attemptVersion: Number(priorVersion) + 1,
            };
          }
        }
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
      }
    }

    throw new ConflictException({
      statusCode: 409,
      code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
      message: 'Idempotency key contention; retry',
      error: 'Conflict',
    });
  }

  async complete(
    rowId: string,
    fingerprint: string,
    result: unknown,
    ownerToken: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!this.prisma && !client) {
      for (const [key, rec] of this.memory.entries()) {
        if (rec.id === rowId) {
          if (rec.ownerToken !== ownerToken || rec.status !== 'IN_PROGRESS') {
            throw new ConflictException({
              statusCode: 409,
              code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
              message: 'Idempotency ownership lost; cannot complete',
              error: 'Conflict',
            });
          }
          this.memory.set(key, {
            ...rec,
            fingerprint,
            result,
            status: 'COMPLETED',
          });
          return;
        }
      }
      throw new ConflictException({
        statusCode: 409,
        code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
        message: 'Idempotency ownership lost; cannot complete',
        error: 'Conflict',
      });
    }

    const run = async (c: Prisma.TransactionClient | PrismaService) => {
      const updated = await (c as Prisma.TransactionClient).portalSchedulingIdempotencyLedger.updateMany({
        where: {
          id: rowId,
          ownerToken,
          status: 'IN_PROGRESS',
        },
        data: {
          fingerprint,
          status: 'COMPLETED',
          responseJson: result as Prisma.InputJsonValue,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
          message: 'Idempotency ownership lost; cannot complete',
          error: 'Conflict',
        });
      }
    };

    if (client) {
      await run(client);
      return;
    }
    await this.prisma!.withPlatformBypass((c) => run(c as unknown as Prisma.TransactionClient));
  }

  async fail(rowId: string, ownerToken: string): Promise<void> {
    if (!this.prisma) {
      for (const [key, rec] of this.memory.entries()) {
        if (rec.id === rowId) {
          if (rec.ownerToken !== ownerToken || rec.status !== 'IN_PROGRESS') {
            return;
          }
          this.memory.set(key, {
            ...rec,
            status: 'FAILED',
            result: null,
            expiresAt: Date.now(),
          });
          return;
        }
      }
      return;
    }
    await this.prisma.withPlatformBypass((c) =>
      c.portalSchedulingIdempotencyLedger.updateMany({
        where: { id: rowId, ownerToken, status: 'IN_PROGRESS' },
        data: {
          status: 'FAILED',
          responseJson: Prisma.JsonNull,
          expiresAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    );
  }

  /** Test helper — clear process-local state (unit tests). */
  clear(): void {
    this.memory.clear();
  }

  async clearForTenant(tenantId: string): Promise<void> {
    if (!this.prisma) {
      for (const key of [...this.memory.keys()]) {
        if (key.startsWith(`${tenantId}:`)) this.memory.delete(key);
      }
      return;
    }
    await this.prisma.withPlatformBypass((c) =>
      c.portalSchedulingIdempotencyLedger.deleteMany({ where: { tenantId } }),
    );
  }
}
