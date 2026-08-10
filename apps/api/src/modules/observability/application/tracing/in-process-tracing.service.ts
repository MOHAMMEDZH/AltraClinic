import { randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityDefaults,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import { CorrelationContextService } from '../logging/correlation-context.service';
import {
  SPAN_ATTRIBUTE_ALLOWLIST,
  SPAN_FORBIDDEN_ATTRIBUTE_KEYS,
  SPAN_ID_PATTERN,
  TRACE_ID_PATTERN,
  TRACEPARENT_HEADER,
  type SpanRecord,
  type SpanStatusCode,
  type StartSpanInput,
  type TraceContext,
  type TracingDiagnostics,
} from '../../domain/tracing.types';
import { TRACE_STORE, type TraceStorePort } from '../ports/storage.port';
import { TRACES_EXPORT, type TracesExportPort } from '../ports/export.port';
import type { TracingService } from '../ports/services';

interface ActiveSpanState {
  context: TraceContext;
  record: SpanRecord;
  parentState?: ActiveSpanState;
}

/**
 * Phase 45d — in-process OpenTelemetry-compatible tracing (OD-TRACING).
 * Fail-open: never throws to business callers on start/end.
 */
@Injectable()
export class InProcessTracingService implements TracingService {
  readonly contractVersion = '45d' as const;

  private readonly als = new AsyncLocalStorage<ActiveSpanState>();
  private spansStarted = 0;
  private spansEnded = 0;
  private spansDropped = 0;
  private sampledOut = 0;
  private attributeRejects = 0;
  private exportFailures = 0;
  private lastError?: string;

  constructor(
    private readonly correlation: CorrelationContextService,
    @Inject(TRACE_STORE) private readonly store: TraceStorePort,
    @Inject(TRACES_EXPORT) private readonly tracesExport: TracesExportPort,
  ) {}

  isActive(): boolean {
    const flags = loadObservabilityFeatureFlags();
    return (
      isSystemMonitoringObservabilityEnabled() && flags.tracingEnabled === true
    );
  }

  generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  isValidTraceId(value: unknown): value is string {
    return typeof value === 'string' && TRACE_ID_PATTERN.test(value.trim());
  }

  isValidSpanId(value: unknown): value is string {
    return typeof value === 'string' && SPAN_ID_PATTERN.test(value.trim());
  }

  parseTraceparent(header: unknown): TraceContext | undefined {
    if (typeof header !== 'string') return undefined;
    const parts = header.trim().split('-');
    if (parts.length < 4) return undefined;
    const [, traceId, spanId, flagsHex] = parts;
    if (!this.isValidTraceId(traceId) || !this.isValidSpanId(spanId)) {
      return undefined;
    }
    const flags = Number.parseInt(flagsHex ?? '00', 16);
    return {
      traceId: traceId!.toLowerCase(),
      spanId: spanId!.toLowerCase(),
      traceFlags: Number.isFinite(flags) ? flags : 0,
      sampled: (flags & 0x1) === 1,
    };
  }

  formatTraceparent(ctx: TraceContext): string {
    const flags = (ctx.sampled ? 1 : 0).toString(16).padStart(2, '0');
    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
  }

  getActiveContext(): TraceContext | undefined {
    return this.als.getStore()?.context;
  }

  /** Run callback under an already-created span state (HTTP middleware). */
  runWithCreatedState<T>(state: ActiveSpanState, fn: () => T): T {
    return this.als.run(state, fn);
  }

  /** Create span state without entering ALS (used by runWith*). */
  createSpan(input: StartSpanInput): {
    ok: boolean;
    state?: ActiveSpanState;
    reason?: string;
  } {
    try {
      if (!this.isActive()) {
        return { ok: false, reason: 'pipeline_inactive' };
      }

      const attrs = this.sanitizeAttributes(input.attributes);
      if (!attrs.ok) {
        this.attributeRejects += 1;
        return { ok: false, reason: attrs.reason };
      }

      const parentState = this.als.getStore();
      const parent = input.parent ?? parentState?.context;
      const defaults = loadObservabilityDefaults();
      const sampleRatio = defaults.defaultTraceSampleRatio;
      let sampled: boolean;
      if (parent) {
        sampled = parent.sampled;
      } else if (sampleRatio >= 1) {
        sampled = true;
      } else if (sampleRatio <= 0) {
        sampled = false;
        this.sampledOut += 1;
      } else {
        sampled = Math.random() < sampleRatio;
        if (!sampled) this.sampledOut += 1;
      }

      const traceId = parent?.traceId ?? this.generateTraceId();
      const spanId = this.generateSpanId();
      const correlationId =
        input.correlationId ??
        this.correlation.getCorrelationId() ??
        parent?.correlationId;
      const tenantId =
        input.tenantId !== undefined
          ? input.tenantId
          : (this.correlation.getContext()?.tenantId ??
            parent?.tenantId ??
            null);

      const context: TraceContext = {
        traceId,
        spanId,
        parentSpanId: parent?.spanId,
        traceFlags: sampled ? 1 : 0,
        correlationId,
        tenantId,
        sampled,
      };

      const record: SpanRecord = {
        traceId,
        spanId,
        parentSpanId: parent?.spanId,
        name: input.name.trim().slice(0, 128) || 'span',
        kind: input.kind ?? 'internal',
        startTimeUnixMs: Date.now(),
        status: 'unset',
        correlationId,
        tenantId,
        service: input.service?.trim() || 'api',
        component: input.component?.trim() || 'tracing',
        attributes: attrs.attributes,
        sampled,
        schemaVersion: '45d',
      };

      this.spansStarted += 1;
      return {
        ok: true,
        state: {
          context,
          record,
          parentState: input.parent ? undefined : parentState,
        },
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'start_failed';
      this.spansDropped += 1;
      return { ok: false, reason: this.lastError };
    }
  }

  startSpan(input: StartSpanInput): {
    ok: boolean;
    context?: TraceContext;
    reason?: string;
  } {
    const created = this.createSpan(input);
    if (!created.ok || !created.state) {
      return { ok: false, reason: created.reason };
    }
    // Push onto ALS stack (preserve parentState for endSpan pop).
    this.als.enterWith(created.state);
    return { ok: true, context: created.state.context };
  }

  endSpan(status: SpanStatusCode = 'ok', statusMessage?: string): void {
    try {
      const active = this.als.getStore();
      if (!active) return;
      if (active.record.endTimeUnixMs == null) {
        active.record.endTimeUnixMs = Date.now();
        active.record.status = status;
        if (statusMessage) {
          active.record.statusMessage = statusMessage.slice(0, 240);
        }
        if (active.record.sampled && this.store.append) {
          const stored = this.store.append({ ...active.record });
          if (!stored.ok) this.spansDropped += 1;
        }
        this.spansEnded += 1;
      }
      // Pop to parent span if present.
      if (active.parentState) {
        this.als.enterWith(active.parentState);
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'end_failed';
      this.spansDropped += 1;
    }
  }

  runWithSpan<T>(input: StartSpanInput, fn: () => T): T {
    const created = this.createSpan(input);
    if (!created.ok || !created.state) {
      return fn();
    }
    return this.als.run(created.state, () => {
      try {
        const result = fn();
        this.endSpan('ok');
        return result;
      } catch (err) {
        this.endSpan('error', err instanceof Error ? err.message : 'error');
        throw err;
      }
    });
  }

  async runWithSpanAsync<T>(
    input: StartSpanInput,
    fn: () => Promise<T>,
  ): Promise<T> {
    const created = this.createSpan(input);
    if (!created.ok || !created.state) {
      return fn();
    }
    return this.als.run(created.state, async () => {
      try {
        const result = await fn();
        this.endSpan('ok');
        return result;
      } catch (err) {
        this.endSpan('error', err instanceof Error ? err.message : 'error');
        throw err;
      }
    });
  }

  contextFromPropagation(input: {
    traceparent?: unknown;
    traceId?: unknown;
    spanId?: unknown;
    correlationId?: unknown;
    tenantId?: string | null;
  }): TraceContext {
    const fromHeader = this.parseTraceparent(input.traceparent);
    if (fromHeader) {
      return {
        ...fromHeader,
        correlationId:
          typeof input.correlationId === 'string'
            ? input.correlationId
            : fromHeader.correlationId,
        tenantId: input.tenantId ?? null,
      };
    }
    const traceId = this.isValidTraceId(input.traceId)
      ? String(input.traceId).toLowerCase()
      : this.generateTraceId();
    const spanId = this.isValidSpanId(input.spanId)
      ? String(input.spanId).toLowerCase()
      : this.generateSpanId();
    return {
      traceId,
      spanId,
      traceFlags: 1,
      sampled: true,
      correlationId:
        typeof input.correlationId === 'string'
          ? input.correlationId
          : undefined,
      tenantId: input.tenantId ?? null,
    };
  }

  attachTraceToPayload<T extends Record<string, unknown>>(
    payload: T,
  ): T & { traceId: string; spanId: string; traceparent: string } {
    const active = this.getActiveContext();
    const ctx =
      active ??
      ({
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
        traceFlags: 1,
        sampled: true,
      } satisfies TraceContext);
    return {
      ...payload,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceparent: this.formatTraceparent(ctx),
    };
  }

  listSpans(filter?: {
    traceId?: string;
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly SpanRecord[] {
    return this.store.list?.(filter) ?? [];
  }

  exportJson(): string {
    try {
      if (!this.tracesExport.renderJson || !this.store.list) return '[]';
      if (!isSystemMonitoringObservabilityEnabled()) return '[]';
      return this.tracesExport.renderJson(this.store.list());
    } catch (err) {
      this.exportFailures += 1;
      this.lastError = err instanceof Error ? err.message : 'export_failed';
      return '[]';
    }
  }

  diagnostics(): TracingDiagnostics {
    return {
      active: this.isActive(),
      spansStarted: this.spansStarted,
      spansEnded: this.spansEnded,
      spansDropped: this.spansDropped,
      sampledOut: this.sampledOut,
      attributeRejects: this.attributeRejects,
      exportFailures: this.exportFailures,
      bufferedSpans: this.store.count?.() ?? 0,
      lastError: this.lastError,
    };
  }

  resetDiagnosticsForTests(): void {
    this.spansStarted = 0;
    this.spansEnded = 0;
    this.spansDropped = 0;
    this.sampledOut = 0;
    this.attributeRejects = 0;
    this.exportFailures = 0;
    this.lastError = undefined;
    this.store.clear?.();
  }

  private sanitizeAttributes(
    input?: Record<string, unknown>,
  ):
    | { ok: true; attributes: Record<string, string | number | boolean | null> }
    | { ok: false; reason: string } {
    if (!input) return { ok: true, attributes: {} };
    const allow = new Set<string>(SPAN_ATTRIBUTE_ALLOWLIST);
    const out: Record<string, string | number | boolean | null> = {};
    for (const [rawKey, rawVal] of Object.entries(input)) {
      const key = rawKey.trim().toLowerCase().replace(/-/g, '_');
      if ((SPAN_FORBIDDEN_ATTRIBUTE_KEYS as readonly string[]).includes(key)) {
        return { ok: false, reason: `forbidden_field:${key}` };
      }
      if (!allow.has(key)) {
        return { ok: false, reason: `disallowed_field:${key}` };
      }
      if (rawVal === null) {
        out[key] = null;
        continue;
      }
      if (typeof rawVal === 'number' || typeof rawVal === 'boolean') {
        out[key] = rawVal;
        continue;
      }
      const str = String(rawVal).trim();
      if (str.length > 128 || str.includes('?') || /bearer\s+/i.test(str)) {
        return { ok: false, reason: `phi_rejected:${key}` };
      }
      out[key] = str;
    }
    return { ok: true, attributes: out };
  }
}

export { TRACEPARENT_HEADER };
