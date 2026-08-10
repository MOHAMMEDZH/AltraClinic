/**
 * Phase 47 Step 07 — AES-256-GCM envelope for platform MFA TOTP secrets.
 *
 * Mirrors the Integrations envelope pattern (webhook/envelope-secret-store.ts)
 * but is owned by the auth module with its own dedicated key material
 * (PLATFORM_MFA_ENCRYPTION_KEY) — never shared with tenant/integrations secrets.
 *
 * Plaintext secrets must never be logged. Callers must not log the return
 * value of decryptPlatformMfaSecret.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENVELOPE_VERSION = '1';
const ALGORITHM = 'aes-256-gcm';

export class PlatformMfaSecretCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformMfaSecretCryptoError';
  }
}

function deriveKey(encryptionKey: string): Buffer {
  return createHash('sha256').update(encryptionKey, 'utf8').digest();
}

export function encryptPlatformMfaSecret(plaintext: string, encryptionKey: string): string {
  if (!encryptionKey) {
    throw new PlatformMfaSecretCryptoError('Platform MFA encryption key is not configured.');
  }
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from(
    JSON.stringify({
      v: ENVELOPE_VERSION,
      alg: ALGORITHM,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    }),
    'utf8',
  );
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32BE(header.byteLength, 0);
  return Buffer.concat([headerLen, header, ciphertext]).toString('base64');
}

export function decryptPlatformMfaSecret(envelopeBase64: string, encryptionKey: string): string {
  if (!encryptionKey) {
    throw new PlatformMfaSecretCryptoError('Platform MFA encryption key is not configured.');
  }
  const key = deriveKey(encryptionKey);
  const envelope = Buffer.from(envelopeBase64, 'base64');
  const headerLen = envelope.readUInt32BE(0);
  const header = JSON.parse(envelope.subarray(4, 4 + headerLen).toString('utf8')) as {
    iv: string;
    tag: string;
  };
  const ciphertext = envelope.subarray(4 + headerLen);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(header.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
