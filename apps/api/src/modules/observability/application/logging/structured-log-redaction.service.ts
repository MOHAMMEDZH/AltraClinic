import { Injectable } from '@nestjs/common';
import {
  LOG_ATTRIBUTE_ALLOWLIST,
  LOG_FORBIDDEN_ATTRIBUTE_KEYS,
  type LogAllowedAttributeKey,
} from '../../domain/logging.types';
import type { RedactionService } from '../ports/services';

export type RedactionOutcome =
  | { ok: true; attributes: Record<string, string | number | boolean | null> }
  | { ok: false; reason: 'forbidden_field' | 'phi_rejected'; key: string };

const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /bearer\s+\S+/i,
  /bk_[a-z0-9]+/i,
  /bki_[a-z0-9]+/i,
  /password/i,
  /-----BEGIN/,
  /select\s+.+\s+from/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
];

/**
 * Phase 45c — PHI/secret redaction (OD-PHI, OD-REDACTION, OD-SECRETS).
 * Fail-closed: unknown high-risk or forbidden keys reject the field set.
 */
@Injectable()
export class StructuredLogRedactionService implements RedactionService {
  readonly contractVersion = '45c' as const;

  redactAttributes(
    input: Record<string, unknown> | undefined,
  ): RedactionOutcome {
    if (!input) return { ok: true, attributes: {} };

    const allow = new Set<string>(LOG_ATTRIBUTE_ALLOWLIST);
    const out: Record<string, string | number | boolean | null> = {};

    for (const [rawKey, rawVal] of Object.entries(input)) {
      const key = rawKey.trim().toLowerCase().replace(/-/g, '_');
      if ((LOG_FORBIDDEN_ATTRIBUTE_KEYS as readonly string[]).includes(key)) {
        return { ok: false, reason: 'forbidden_field', key };
      }
      if (!allow.has(key)) {
        return { ok: false, reason: 'forbidden_field', key };
      }
      if (rawVal === undefined) continue;
      if (rawVal === null) {
        out[key] = null;
        continue;
      }
      if (
        typeof rawVal === 'number' ||
        typeof rawVal === 'boolean'
      ) {
        out[key] = rawVal;
        continue;
      }
      const str = String(rawVal).trim();
      if (str.length > 128) {
        return { ok: false, reason: 'phi_rejected', key };
      }
      if (this.valueLooksSensitive(key, str)) {
        return { ok: false, reason: 'phi_rejected', key };
      }
      out[key as LogAllowedAttributeKey] = str;
    }

    return { ok: true, attributes: out };
  }

  redactError(error: unknown): {
    name: string;
    code?: string;
    message: string;
    stackPreview?: string;
  } {
    if (error == null) {
      return { name: 'Error', message: 'unknown' };
    }
    if (typeof error === 'string') {
      return {
        name: 'Error',
        message: this.sanitizeText(error),
      };
    }
    const err = error as {
      name?: string;
      message?: string;
      code?: string | number;
      stack?: string;
    };
    return {
      name: this.sanitizeText(err.name ?? 'Error').slice(0, 64),
      code: err.code != null ? String(err.code).slice(0, 64) : undefined,
      message: this.sanitizeText(err.message ?? 'error'),
      stackPreview: err.stack
        ? this.sanitizeText(err.stack).slice(0, 500)
        : undefined,
    };
  }

  sanitizeText(message: string): string {
    let m = message.replace(/\s+/g, ' ').trim().slice(0, 240);
    m = m.replace(/bearer\s+\S+/gi, 'bearer [REDACTED]');
    m = m.replace(/bk_[a-z0-9]+/gi, '[REDACTED_KEY]');
    m = m.replace(/bki_[a-z0-9]+/gi, '[REDACTED_KEY]');
    return m;
  }

  private valueLooksSensitive(key: string, value: string): boolean {
    if (key === 'path_template') {
      // Allow templates like /patients/:id — reject query strings
      if (value.includes('?') || value.includes('=')) return true;
      return false;
    }
    for (const re of SENSITIVE_VALUE_PATTERNS) {
      if (re.test(value)) return true;
    }
    if (value.includes('@') && key !== 'path_template') return true;
    return false;
  }
}
