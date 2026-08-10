import { createHash } from 'crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';

export interface PortalIdempotencyRecord {
  fingerprint: string;
  status: 'completed';
  result: unknown;
  createdAt: number;
}

/**
 * Phase 46c — tenant+patient scoped mutation idempotency (portal-native metadata).
 * Process-local store; keys never become appointment SoR.
 */
@Injectable()
export class PortalSchedulingIdempotencyService {
  private readonly store = new Map<string, PortalIdempotencyRecord>();

  fingerprint(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
  }

  private key(
    tenantId: string,
    patientId: string,
    operation: string,
    idempotencyKey: string,
  ): string {
    return `${tenantId}:${patientId}:${operation}:${idempotencyKey}`;
  }

  beginOrReplay(input: {
    tenantId: string;
    patientId: string;
    operation: string;
    idempotencyKey: string;
    fingerprint: string;
  }): { kind: 'replay'; result: unknown } | { kind: 'proceed'; storageKey: string } {
    const storageKey = this.key(
      input.tenantId,
      input.patientId,
      input.operation,
      input.idempotencyKey,
    );
    const existing = this.store.get(storageKey);
    if (!existing) {
      return { kind: 'proceed', storageKey };
    }
    if (existing.fingerprint !== input.fingerprint) {
      throw new ConflictException({
        statusCode: 409,
        code: PATIENT_PORTAL_ERROR_CODES.IDEMPOTENCY_MISMATCH,
        message: 'Idempotency key was reused with a different request',
        error: 'Conflict',
      });
    }
    return { kind: 'replay', result: existing.result };
  }

  complete(storageKey: string, fingerprint: string, result: unknown): void {
    this.store.set(storageKey, {
      fingerprint,
      status: 'completed',
      result,
      createdAt: Date.now(),
    });
  }

  /** Test helper — clear process-local state. */
  clear(): void {
    this.store.clear();
  }
}
