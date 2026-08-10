import { Injectable, Logger } from '@nestjs/common';

/** Bounded audit sink — never logs secrets/PHI. */
@Injectable()
export class FeatureFlagsSettingsAuditLog {
  private readonly logger = new Logger(FeatureFlagsSettingsAuditLog.name);
  readonly entries: Array<Record<string, unknown>> = [];

  record(event: {
    action: string;
    actorId: string;
    resourceType: string;
    resourceId: string;
    reason?: string;
    correlationId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }): void {
    const row = {
      ...event,
      at: new Date().toISOString(),
    };
    this.entries.push(row);
    this.logger.log({
      msg: 'feature_flags_settings_audit',
      action: event.action,
      actorId: event.actorId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      correlationId: event.correlationId,
    });
  }
}
