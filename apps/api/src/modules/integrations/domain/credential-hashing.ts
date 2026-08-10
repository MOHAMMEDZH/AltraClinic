/**
 * Phase 44b — OD-HASH: SHA-256(pepper || raw) + constant-time compare.
 * Never logs raw credentials or pepper material.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  API_CREDENTIAL_PEPPER_REF_ENV,
  INTEGRATIONS_HASH_ALGORITHM_ID,
} from '../integrations.constants';

/** Architecture: ≥ 192 bits CSPRNG (24 bytes). */
export const CREDENTIAL_ENTROPY_BYTES = 24;

export const CREDENTIAL_PREFIX_USER = 'bk_';
export const CREDENTIAL_PREFIX_INTEGRATION = 'bki_';
export const CREDENTIAL_PUBLIC_PREFIX_LENGTH = 12;

export class PepperNotConfiguredError extends Error {
  constructor() {
    super(
      `${API_CREDENTIAL_PEPPER_REF_ENV} pepper material missing — fail closed`,
    );
    this.name = 'PepperNotConfiguredError';
  }
}

/**
 * Resolve pepper material.
 * `API_CREDENTIAL_PEPPER_REF` holds either the pepper string itself, or the name
 * of another env var that holds the pepper (ops/KMS-style indirection).
 */
export function resolvePepperMaterial(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const refOrValue = (env[API_CREDENTIAL_PEPPER_REF_ENV] ?? '').trim();
  if (!refOrValue) return null;
  const indirect = (env[refOrValue] ?? '').trim();
  if (indirect.length > 0) return indirect;
  return refOrValue;
}

export function isPepperConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const pepper = resolvePepperMaterial(env);
  return Boolean(pepper && pepper.length >= 16);
}

export function hashApiCredential(
  rawKey: string,
  pepper: string,
): string {
  if (!pepper || pepper.length < 16) {
    throw new PepperNotConfiguredError();
  }
  if (!rawKey || rawKey.length < 16) {
    throw new Error('Raw credential entropy too low');
  }
  return createHash('sha256')
    .update(pepper, 'utf8')
    .update(rawKey, 'utf8')
    .digest('hex');
}

/**
 * Constant-time hex digest comparison (equal length required).
 */
export function verifyApiCredentialHash(
  rawKey: string,
  storedHashHex: string,
  pepper: string,
): boolean {
  const computed = hashApiCredential(rawKey, pepper);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHashHex, 'hex');
  if (a.length === 0 || a.length !== b.length) {
    // Consume comparable work then deny (avoid short-circuit oracle on length).
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(a, b);
}

export interface GeneratedCredentialMaterial {
  raw: string;
  prefix: string;
  keyHash: string;
  hashAlgorithm: typeof INTEGRATIONS_HASH_ALGORITHM_ID;
}

export function generateApiCredentialMaterial(input: {
  pepper: string;
  /** Use bki_ for integration-bound keys; default bk_. */
  integrationBound?: boolean;
}): GeneratedCredentialMaterial {
  const prefixKind = input.integrationBound
    ? CREDENTIAL_PREFIX_INTEGRATION
    : CREDENTIAL_PREFIX_USER;
  const raw = `${prefixKind}${randomBytes(CREDENTIAL_ENTROPY_BYTES).toString('hex')}`;
  const prefix = raw.slice(0, CREDENTIAL_PUBLIC_PREFIX_LENGTH);
  const keyHash = hashApiCredential(raw, input.pepper);
  return {
    raw,
    prefix,
    keyHash,
    hashAlgorithm: INTEGRATIONS_HASH_ALGORITHM_ID,
  };
}

/** Legacy Settings hash (unpeppered) — for dual-write compatibility only. */
export function hashLegacySettingsKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/**
 * Redact credential-like tokens from strings (bk_/bki_ prefixed secrets).
 */
export function redactCredentialSecrets(value: string): string {
  return value
    .replace(/\bbki_[A-Za-z0-9]+/g, 'bki_[REDACTED]')
    .replace(/\bbk_[A-Za-z0-9]+/g, 'bk_[REDACTED]');
}
