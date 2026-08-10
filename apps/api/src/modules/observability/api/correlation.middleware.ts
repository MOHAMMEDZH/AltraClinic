import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CorrelationContextService } from '../application/logging/correlation-context.service';

/**
 * Phase 45c — HTTP ingress correlation middleware (OD-CORRELATION).
 * When observability logging is inactive, still generates ephemeral context
 * only if active; otherwise passes through without ALS (dormant).
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlation: CorrelationContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Always bind request/operation correlation for Step 21 durability semantics.
    // Observability "active" only gates metrics/log enrichment — not ALS correlation.
    const ctx = this.correlation.bindHttp(
      req.headers as Record<string, string | string[] | undefined>,
      (name, value) => {
        res.setHeader(name, value);
      },
      {
        module: 'http',
        operation: `${req.method} ${req.route?.path ?? req.path}`,
      },
    );
    res.setHeader('x-correlation-id', ctx.correlationId);
    this.correlation.runWithContext(ctx, () => next());
  }
}
