import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  CAUSATION_ID_HEADER,
  CORRELATION_ID_HEADER,
  CORRELATION_ID_PATTERN,
  type CorrelationContext,
} from '../../domain/correlation.types';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import type { CorrelationService } from '../ports/services';
import { registerOperationCorrelationContextGetter } from '../../../platform-audit-center/application/operation-correlation';

/**
 * Phase 45c — correlation generation, validation, ALS propagation (OD-CORRELATION).
 * Fail-open for business: when inactive, helpers are no-ops / generate ephemeral ids for local use only.
 */
@Injectable()
export class CorrelationContextService
  implements CorrelationService, OnModuleInit, OnModuleDestroy
{
  readonly contractVersion = '45c' as const;

  private readonly als = new AsyncLocalStorage<CorrelationContext>();
  private generated = 0;
  private inherited = 0;
  private rejectedInbound = 0;

  onModuleInit(): void {
    registerOperationCorrelationContextGetter(() => this.getCorrelationId());
  }

  onModuleDestroy(): void {
    registerOperationCorrelationContextGetter(null);
  }

  isActive(): boolean {
    const flags = loadObservabilityFeatureFlags();
    return (
      isSystemMonitoringObservabilityEnabled() && flags.loggingEnabled === true
    );
  }

  generateId(): string {
    this.generated += 1;
    return randomUUID();
  }

  isValidId(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) return false;
    return CORRELATION_ID_PATTERN.test(trimmed);
  }

  /**
   * Resolve inbound id: preserve if valid; else generate.
   * Malformed inbound is rejected (not used for authz) and replaced.
   */
  resolveIngressId(inbound: unknown): { id: string; inherited: boolean } {
    if (this.isValidId(inbound)) {
      this.inherited += 1;
      return { id: inbound.trim(), inherited: true };
    }
    if (inbound != null && String(inbound).trim() !== '') {
      this.rejectedInbound += 1;
    }
    return { id: this.generateId(), inherited: false };
  }

  getContext(): CorrelationContext | undefined {
    return this.als.getStore();
  }

  getCorrelationId(): string | undefined {
    return this.als.getStore()?.correlationId;
  }

  runWithContext<T>(ctx: CorrelationContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  async runWithContextAsync<T>(
    ctx: CorrelationContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.als.run(ctx, fn);
  }

  /**
   * Bind HTTP request/response: set header, enter ALS when active.
   */
  bindHttp(
    headers: Record<string, string | string[] | undefined>,
    setHeader: (name: string, value: string) => void,
    extras?: Partial<CorrelationContext>,
  ): CorrelationContext {
    const raw =
      headerValue(headers, CORRELATION_ID_HEADER) ??
      headerValue(headers, 'x-request-id');
    const causationRaw = headerValue(headers, CAUSATION_ID_HEADER);
    const { id, inherited } = this.resolveIngressId(raw);
    const causationId = this.isValidId(causationRaw)
      ? causationRaw.trim()
      : undefined;

    const ctx: CorrelationContext = {
      correlationId: id,
      causationId,
      inherited,
      source: 'http',
      ...extras,
    };

    // Always echo correlation on HTTP responses (Step 21 request/operation contract).
    setHeader(CORRELATION_ID_HEADER, id);
    return ctx;
  }

  /** Propagate into queue/job payload fields (non-authoritative). */
  attachToPayload<T extends Record<string, unknown>>(
    payload: T,
    opts?: { causationId?: string },
  ): T & { correlationId: string; causationId?: string } {
    const current = this.getContext();
    const correlationId =
      current?.correlationId ??
      (this.isActive() ? this.generateId() : this.generateId());
    const causationId =
      opts?.causationId ?? current?.causationId ?? current?.correlationId;
    return {
      ...payload,
      correlationId,
      ...(causationId ? { causationId } : {}),
    };
  }

  /** Start context from queue/job payload. */
  contextFromPayload(
    payload: { correlationId?: unknown; causationId?: unknown },
    extras?: Partial<CorrelationContext>,
  ): CorrelationContext {
    const { id, inherited } = this.resolveIngressId(payload.correlationId);
    const causationId = this.isValidId(payload.causationId)
      ? String(payload.causationId).trim()
      : undefined;
    return {
      correlationId: id,
      causationId,
      inherited,
      source: extras?.source ?? 'queue',
      ...extras,
    };
  }

  diagnostics() {
    return {
      active: this.isActive(),
      generated: this.generated,
      inherited: this.inherited,
      rejectedInbound: this.rejectedInbound,
      header: CORRELATION_ID_HEADER,
    };
  }
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (!key) return undefined;
  const v = headers[key];
  if (Array.isArray(v)) return v[0];
  return v;
}
