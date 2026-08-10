import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { Injectable } from '@nestjs/common';
import type { CompressionAlgorithm, EncryptionClass } from '../domain/value-objects';
import type { CompressionService, EncryptionService } from '../application/ports/services';
import { loadBackupRestoreFoundationConfig } from '../config/backup-restore-config';

export interface CompressionResult {
  algorithm: CompressionAlgorithm;
  level: number;
  inputBytes: number;
  outputBytes: number;
  body: Buffer;
}

export interface EncryptionResult {
  encryptionClass: EncryptionClass;
  algorithm: string | null;
  keyReference: string | null;
  keyVersion: string | null;
  applied: boolean;
  body: Buffer;
  /** Opaque envelope header length for decrypt orchestration tests. */
  envelopeHeaderBytes: number;
}

/**
 * Phase 43c — compression orchestration via Node zlib (approved library).
 */
@Injectable()
export class GzipCompressionOrchestrator implements CompressionService {
  readonly contractVersion = '43c' as const;

  compress(body: Buffer, level = 6): CompressionResult {
    const output = gzipSync(body, { level });
    return {
      algorithm: 'gzip',
      level,
      inputBytes: body.byteLength,
      outputBytes: output.byteLength,
      body: output,
    };
  }

  /** Test helper — not a restore engine. */
  decompress(body: Buffer): Buffer {
    return gunzipSync(body);
  }
}

/**
 * Phase 43c — encryption orchestration via Node crypto AES-256-GCM.
 * Key material loaded only via BACKUP_RESTORE_ENCRYPTION_KEY_REF → env var name.
 * No secrets in source. No KMS implementation.
 */
@Injectable()
export class EnvelopeEncryptionOrchestrator implements EncryptionService {
  readonly contractVersion = '43c' as const;

  encrypt(body: Buffer, encryptionClass: EncryptionClass): EncryptionResult {
    if (encryptionClass === 'none') {
      return {
        encryptionClass: 'none',
        algorithm: null,
        keyReference: null,
        keyVersion: null,
        applied: false,
        body,
        envelopeHeaderBytes: 0,
      };
    }

    const keyRef = (process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF ?? '').trim() || null;
    const keyVersion = (process.env.BACKUP_RESTORE_ENCRYPTION_KEY_VERSION ?? '1').trim();
    const key = this.resolveKey(keyRef);

    if (!key) {
      throw new EncryptionConfigurationError(
        'Encryption key unavailable — set BACKUP_RESTORE_ENCRYPTION_KEY_REF to an env var name holding key material',
      );
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
    const tag = cipher.getAuthTag();
    const header = Buffer.from(
      JSON.stringify({
        v: keyVersion,
        alg: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
      }),
      'utf8',
    );
    const headerLen = Buffer.alloc(4);
    headerLen.writeUInt32BE(header.byteLength, 0);
    const envelope = Buffer.concat([headerLen, header, ciphertext]);

    return {
      encryptionClass,
      algorithm: 'aes-256-gcm',
      keyReference: keyRef,
      keyVersion,
      applied: true,
      body: envelope,
      envelopeHeaderBytes: 4 + header.byteLength,
    };
  }

  /** Test helper — not a restore engine. */
  decrypt(envelope: Buffer): Buffer {
    const headerLen = envelope.readUInt32BE(0);
    const header = JSON.parse(envelope.subarray(4, 4 + headerLen).toString('utf8')) as {
      iv: string;
      tag: string;
    };
    const keyRef = (process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF ?? '').trim() || null;
    const key = this.resolveKey(keyRef);
    if (!key) throw new EncryptionConfigurationError('Encryption key unavailable for decrypt helper');
    const iv = Buffer.from(header.iv, 'base64');
    const tag = Buffer.from(header.tag, 'base64');
    const ciphertext = envelope.subarray(4 + headerLen);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  private resolveKey(keyRef: string | null): Buffer | null {
    if (!keyRef) return null;
    const raw = process.env[keyRef];
    if (!raw || !raw.trim()) return null;
    const hash = createHash('sha256').update(raw.trim(), 'utf8').digest();
    return hash;
  }
}

export class EncryptionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionConfigurationError';
  }
}

export function sha256Hex(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function defaultEncryptionClass(): EncryptionClass {
  return loadBackupRestoreFoundationConfig().defaults.encryptionClass;
}
