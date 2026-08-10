import { Injectable, Logger } from '@nestjs/common';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';

/**
 * Phase 46b — non-PHI Activity references for portal identity events.
 */
@Injectable()
export class PatientPortalActivityEmitter {
  private readonly logger = new Logger(PatientPortalActivityEmitter.name);

  constructor(private readonly observability: PatientPortalObservabilityContracts) {}

  emit(input: {
    event: string;
    tenantId: string;
    correlationId?: string | null;
  }): void {
    const fields = this.observability.createFoundationLogFields({
      event: input.event,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });
    this.logger.log({
      ...fields,
      component: 'activity',
    });
  }
}
