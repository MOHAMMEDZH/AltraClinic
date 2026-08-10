import { Injectable, Logger } from '@nestjs/common';
import {
  createOutboundSigningHeaders,
  redactWebhookSensitive,
  WEBHOOK_HTTP_TIMEOUT_MS,
  WEBHOOK_MAX_PAYLOAD_BYTES,
} from '../../domain/webhook/webhook-hmac';
import { evaluateWebhookUrlSafety } from '../../infrastructure/webhook/ssrf-guard';
import type { WebhookAttemptOutcome } from '../../domain/webhook/webhook.types';

export interface DispatchResult {
  outcome: WebhookAttemptOutcome;
  responseCode: number | null;
  latencyMs: number;
  errorMessage: string | null;
  nonce: string;
}

/**
 * Phase 44c — outbound HTTP dispatcher (HTTPS + SSRF + HMAC).
 * Does not follow redirects; bounded timeout; JSON POST only.
 */
@Injectable()
export class WebhookHttpDispatcher {
  private readonly logger = new Logger(WebhookHttpDispatcher.name);

  async dispatch(input: {
    url: string;
    rawBody: string;
    secret: string;
    timeoutMs?: number;
    customHeaders?: Record<string, string>;
    /** Injected for tests — when set, skips real fetch. */
    fetchImpl?: typeof fetch;
  }): Promise<DispatchResult> {
    const safety = evaluateWebhookUrlSafety(input.url);
    if (!safety.safe) {
      return {
        outcome: 'permanent',
        responseCode: null,
        latencyMs: 0,
        errorMessage: safety.reason,
        nonce: '',
      };
    }

    if (Buffer.byteLength(input.rawBody, 'utf8') > WEBHOOK_MAX_PAYLOAD_BYTES) {
      return {
        outcome: 'permanent',
        responseCode: null,
        latencyMs: 0,
        errorMessage: 'payload_too_large',
        nonce: '',
      };
    }

    const signed = createOutboundSigningHeaders(input.secret, input.rawBody);
    const headers: Record<string, string> = {
      ...signed.headers,
      ...(input.customHeaders ?? {}),
    };
    // Never allow overriding signature/auth via custom headers
    delete headers.Authorization;
    delete headers.authorization;

    const timeoutMs = input.timeoutMs ?? WEBHOOK_HTTP_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    const fetchFn = input.fetchImpl ?? fetch;

    try {
      const response = await fetchFn(input.url, {
        method: 'POST',
        headers,
        body: input.rawBody,
        signal: controller.signal,
        redirect: 'error',
      });
      const latencyMs = Date.now() - started;
      if (response.ok) {
        return {
          outcome: 'succeeded',
          responseCode: response.status,
          latencyMs,
          errorMessage: null,
          nonce: signed.nonce,
        };
      }
      const text = await response.text().catch(() => '');
      const outcome: WebhookAttemptOutcome =
        response.status === 429 || response.status >= 500
          ? 'retryable'
          : 'permanent';
      return {
        outcome,
        responseCode: response.status,
        latencyMs,
        errorMessage: redactWebhookSensitive(
          `http_${response.status}:${text.slice(0, 200)}`,
        ),
        nonce: signed.nonce,
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      this.logger.warn(
        JSON.stringify({
          kind: 'integrations',
          component: 'webhook_dispatcher',
          event: 'dispatch_error',
          message: redactWebhookSensitive(message),
        }),
      );
      return {
        outcome: isAbort ? 'timeout' : 'retryable',
        responseCode: null,
        latencyMs,
        errorMessage: redactWebhookSensitive(message).slice(0, 300),
        nonce: signed.nonce,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
