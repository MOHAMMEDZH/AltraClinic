/**
 * Phase 44c — AES-256-GCM envelope for recoverable webhook secrets (OD-SECRET-STORE).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { INTEGRATIONS_SECRET_KEY_REF_ENV } from '../../integrations.constants';

export class SecretStoreNotConfiguredError extends Error {
  constructor() {
    super(
      `${INTEGRATIONS_SECRET_KEY_REF_ENV} material missing — secret store fail closed`,
    );
    this.name = 'SecretStoreNotConfiguredError';
  }
}

function resolveKeyMaterial(
  env: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  const refOrValue = (env[INTEGRATIONS_SECRET_KEY_REF_ENV] ?? '').trim();
  if (!refOrValue) return null;
  const indirect = (env[refOrValue] ?? '').trim();
  const material = indirect.length > 0 ? indirect : refOrValue;
  if (material.length < 16) return null;
  return createHash('sha256').update(material, 'utf8').digest();
}

export function isIntegrationsSecretStoreReady(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveKeyMaterial(env) !== null;
}

export function encryptWebhookSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = resolveKeyMaterial(env);
  if (!key) throw new SecretStoreNotConfiguredError();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from(
    JSON.stringify({
      v: '1',
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    }),
    'utf8',
  );
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32BE(header.byteLength, 0);
  return Buffer.concat([headerLen, header, ciphertext]).toString('base64');
}

export function decryptWebhookSecret(
  envelopeBase64: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = resolveKeyMaterial(env);
  if (!key) throw new SecretStoreNotConfiguredError();
  const envelope = Buffer.from(envelopeBase64, 'base64');
  const headerLen = envelope.readUInt32BE(0);
  const header = JSON.parse(
    envelope.subarray(4, 4 + headerLen).toString('utf8'),
  ) as { iv: string; tag: string };
  const ciphertext = envelope.subarray(4 + headerLen);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(header.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export function generateWebhookSigningSecret(): string {
  return randomBytes(32).toString('base64url');
}
