import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { InProcessTracingService } from '../application/tracing/in-process-tracing.service';
import { CorrelationContextService } from '../application/logging/correlation-context.service';
import { TRACEPARENT_HEADER } from '../domain/tracing.types';

/**
 * Phase 45d — HTTP trace context propagation (OD-TRACING / OD-CORRELATION).
 * Fail-open: never blocks the request on tracing errors.
 */
@Injectable()
export class TracingMiddleware implements NestMiddleware {
  constructor(
    private readonly tracing: InProcessTracingService,
    private readonly correlation: CorrelationContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.tracing.isActive()) {
      next();
      return;
    }

    try {
      const inbound = this.tracing.parseTraceparent(
        req.headers[TRACEPARENT_HEADER],
      );
      const parent = inbound
        ? {
            ...inbound,
            correlationId: this.correlation.getCorrelationId(),
            tenantId: this.correlation.getContext()?.tenantId ?? null,
          }
        : undefined;

      const created = this.tracing.createSpan({
        name: `HTTP ${req.method}`,
        kind: 'server',
        parent,
        correlationId: this.correlation.getCorrelationId(),
        tenantId: this.correlation.getContext()?.tenantId ?? null,
        component: 'http',
        attributes: {
          method: req.method.toUpperCase(),
          http_route_template: String(req.route?.path ?? req.path ?? '/').slice(
            0,
            128,
          ),
        },
      });

      if (!created.ok || !created.state) {
        next();
        return;
      }

      res.setHeader(
        TRACEPARENT_HEADER,
        this.tracing.formatTraceparent(created.state.context),
      );

      this.tracing.runWithCreatedState(created.state, () => {
        let ended = false;
        const finish = () => {
          if (ended) return;
          ended = true;
          try {
            const statusClass = `${Math.floor((res.statusCode || 200) / 100)}xx`;
            created.state!.record.attributes.status_class = statusClass;
            this.tracing.endSpan(
              res.statusCode >= 500 ? 'error' : 'ok',
              res.statusCode >= 500 ? `http_${res.statusCode}` : undefined,
            );
          } catch {
            // fail-open
          }
        };
        res.on('finish', finish);
        res.on('close', finish);
        next();
      });
    } catch {
      next();
    }
  }
}
