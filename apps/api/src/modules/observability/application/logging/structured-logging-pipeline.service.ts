import { hostname } from 'node:os';
import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import type {
  LogWriteInput,
  LogWriteRejectReason,
  LogWriteResult,
  LoggingPipelineDiagnostics,
  StructuredLogEvent,
} from '../../domain/logging.types';
import { CorrelationContextService } from './correlation-context.service';
import { StructuredLogRedactionService } from './structured-log-redaction.service';
import {
  LOG_STORE,
  type LogStorePort,
} from '../ports/storage.port';
import {
  LOGS_EXPORT,
  type LogsExportPort,
} from '../ports/export.port';
import type { LoggingPipelineService } from '../ports/services';

const SERVICE_VERSION = '45c';

/**
 * Phase 45c — structured logging pipeline (OD-LOGGING, OD-FAILURE, OD-PHI).
 * Never throws to business callers.
 */
@Injectable()
export class StructuredLoggingPipelineService implements LoggingPipelineService {
  readonly contractVersion = '45c' as const;

  private eventsAccepted = 0;
  private eventsRejected = 0;
  private exportFailures = 0;
  private lastError?: string;
  private readonly rejectsByReason: Partial<
    Record<LogWriteRejectReason, number>
  > = {};

  constructor(
    private readonly correlation: CorrelationContextService,
    private readonly redaction: StructuredLogRedactionService,
    @Inject(LOG_STORE) private readonly store: LogStorePort,
    @Inject(LOGS_EXPORT) private readonly logsExport: LogsExportPort,
  ) {}

  isActive(): boolean {
    const flags = loadObservabilityFeatureFlags();
    return (
      isSystemMonitoringObservabilityEnabled() &&
      flags.loggingEnabled === true &&
      typeof this.store.append === 'function'
    );
  }

  write(input: LogWriteInput): LogWriteResult {
    try {
      if (!this.isActive()) {
        return this.reject('pipeline_inactive');
      }
      if (!input.event?.trim() || !input.message?.trim() || !input.module?.trim()) {
        return this.reject('invalid_schema', 'event/message/module required');
      }

      const attrResult = this.redaction.redactAttributes(input.attributes);
      if (!attrResult.ok) {
        return this.reject(
          attrResult.reason === 'forbidden_field'
            ? 'forbidden_field'
            : 'phi_rejected',
          attrResult.key,
        );
      }

      const ctx = this.correlation.getContext();
      const correlationId =
        (input.correlationId &&
        this.correlation.isValidId(input.correlationId)
          ? input.correlationId.trim()
          : undefined) ??
        ctx?.correlationId ??
        this.correlation.generateId();

      const causationId =
        (input.causationId && this.correlation.isValidId(input.causationId)
          ? input.causationId.trim()
          : undefined) ?? ctx?.causationId;

      let tenantId =
        input.tenantId !== undefined
          ? input.tenantId
          : (ctx?.tenantId ?? null);
      const scope = input.scope ?? (tenantId ? 'tenant' : 'platform');
      if (scope === 'platform' || scope === 'system') {
        tenantId = null;
      }

      const event: StructuredLogEvent = {
        timestamp: new Date().toISOString(),
        severity: input.severity,
        category: input.category,
        event: input.event.trim(),
        correlationId,
        causationId,
        tenantId,
        branchId: input.branchId ?? ctx?.branchId ?? null,
        module: input.module.trim(),
        operation: input.operation?.trim() || 'unknown',
        source: input.source?.trim() || ctx?.source || 'internal',
        version: SERVICE_VERSION,
        environment: process.env.NODE_ENV ?? 'development',
        host: safeHost(),
        processId: process.pid,
        service: input.service?.trim() || 'api',
        component: input.component?.trim() || input.module.trim(),
        scope,
        dataClass:
          input.dataClass ??
          (tenantId ? 'ops_tenant' : 'ops_platform'),
        message: this.redaction.sanitizeText(input.message),
        attributes: {
          ...attrResult.attributes,
        },
        featureFlagEnabled: true,
        schemaVersion: '45c',
      };

      if (input.error !== undefined) {
        event.error = this.redaction.redactError(input.error);
      }

      if (!this.store.append) {
        return this.reject('store_rejected', 'append missing');
      }
      const stored = this.store.append(event);
      if (!stored.ok) {
        return this.reject('store_rejected', stored.reason);
      }

      this.eventsAccepted += 1;
      return { ok: true, event };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'write_failed';
      return this.reject('store_rejected', this.lastError);
    }
  }

  query(filter?: {
    tenantId?: string | null;
    sinceMs?: number;
    category?: string;
    correlationId?: string;
    includeOtherTenants?: boolean;
  }): readonly StructuredLogEvent[] {
    if (!this.store.list) return [];
    if (!isSystemMonitoringObservabilityEnabled()) return [];
    return this.store.list(filter);
  }

  exportNdjson(): string {
    try {
      if (!this.logsExport.renderNdjson || !this.store.list) {
        return '';
      }
      if (!isSystemMonitoringObservabilityEnabled()) {
        return '';
      }
      return this.logsExport.renderNdjson(this.store.list());
    } catch (err) {
      this.exportFailures += 1;
      this.lastError = err instanceof Error ? err.message : 'export_failed';
      return '';
    }
  }

  diagnostics(): LoggingPipelineDiagnostics {
    return {
      active: this.isActive(),
      eventsAccepted: this.eventsAccepted,
      eventsRejected: this.eventsRejected,
      rejectsByReason: { ...this.rejectsByReason },
      exportFailures: this.exportFailures,
      bufferedEvents: this.store.count?.() ?? 0,
      lastError: this.lastError,
    };
  }

  resetDiagnosticsForTests(): void {
    this.eventsAccepted = 0;
    this.eventsRejected = 0;
    this.exportFailures = 0;
    this.lastError = undefined;
    for (const k of Object.keys(this.rejectsByReason)) {
      delete this.rejectsByReason[k as LogWriteRejectReason];
    }
    this.store.clear?.();
  }

  private reject(
    reason: LogWriteRejectReason,
    detail?: string,
  ): LogWriteResult {
    this.eventsRejected += 1;
    this.rejectsByReason[reason] = (this.rejectsByReason[reason] ?? 0) + 1;
    return { ok: false, reason, detail };
  }
}

function safeHost(): string {
  try {
    return hostname().slice(0, 64);
  } catch {
    return 'unknown';
  }
}
