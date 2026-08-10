/**
 * Phase 44c — HMAC-SHA256 webhook signing / verification (OD aligned with Notification).
 * Signature: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * Headers: X-Booking-Signature, X-Booking-Timestamp, X-Booking-Nonce
 */

import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'X-Booking-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Booking-Timestamp';
export const WEBHOOK_NONCE_HEADER = 'X-Booking-Nonce';

/** Architecture skew window (seconds). */
export const WEBHOOK_TIMESTAMP_SKEW_SECONDS = 300;

export const WEBHOOK_MAX_PAYLOAD_BYTES = 256 * 1024;
export const WEBHOOK_HTTP_TIMEOUT_MS = 10_000;

export function signWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length === 0 || ba.length !== bb.length) {
      timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signatureHex: string;
  nowSeconds?: number;
  maxSkewSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'timestamp_invalid' };
  }
  const skew = Math.abs(now - ts);
  const maxSkew = input.maxSkewSeconds ?? WEBHOOK_TIMESTAMP_SKEW_SECONDS;
  if (skew > maxSkew) {
    return { ok: false, reason: 'timestamp_skew' };
  }
  const expected = signWebhookPayload(
    input.secret,
    input.timestamp,
    input.rawBody,
  );
  if (!constantTimeEqualHex(expected, input.signatureHex.trim().toLowerCase())) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  return { ok: true };
}

export function createOutboundSigningHeaders(secret: string, rawBody: string): {
  headers: Record<string, string>;
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signature = signWebhookPayload(secret, timestamp, rawBody);
  return {
    timestamp,
    nonce,
    signature,
    headers: {
      'Content-Type': 'application/json',
      [WEBHOOK_SIGNATURE_HEADER]: signature,
      [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
      [WEBHOOK_NONCE_HEADER]: nonce,
    },
  };
}

/** Redact secrets / signatures / auth headers from log strings. */
export function redactWebhookSensitive(value: string): string {
  return value
    .replace(/X-Booking-Signature:\s*[^\s,]+/gi, 'X-Booking-Signature: [REDACTED]')
    .replace(/Authorization:\s*[^\s,]+/gi, 'Authorization: [REDACTED]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[REDACTED_HEX]')
    .replace(/\bbki_[A-Za-z0-9]+/g, 'bki_[REDACTED]')
    .replace(/\bbk_[A-Za-z0-9]+/g, 'bk_[REDACTED]');
}
