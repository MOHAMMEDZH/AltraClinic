import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import {
  PatientPortalActingContextService,
  type PortalActingContext,
} from '../services/patient-portal-acting-context.service';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { buildPatientPortalSafeError } from '../../api/patient-portal-safe-errors';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';
import { PatientPortalActivityEmitter } from '../services/patient-portal-activity.emitter';
import { PORTAL_AUDIT_LOG } from '../../../../infrastructure/provider.tokens';
import { PortalAuditLog } from '../ports/portal-audit-log.port';

/** Minimized patient-safe profile — Patients SoR only. */
export interface PortalSafeProfileDto {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  localeHint: string | null;
  actingContext: 'self' | 'caregiver';
}

@Injectable()
export class GetPortalSafeProfileHandler {
  private readonly logger = new Logger(GetPortalSafeProfileHandler.name);

  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    private readonly tenantContext: TenantContextService,
    private readonly actingContext: PatientPortalActingContextService,
    private readonly observability: PatientPortalObservabilityContracts,
    private readonly activity: PatientPortalActivityEmitter,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
  ) {}

  async execute(input: {
    actorUserId: string;
    actorRoles: string[];
    actingContextHeader?: string | null;
    subjectPatientIdHeader?: string | null;
    correlationId?: string | null;
  }): Promise<PortalSafeProfileDto> {
    const ctx = await this.actingContext.resolve({
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
      actingContextHeader: input.actingContextHeader,
      subjectPatientIdHeader: input.subjectPatientIdHeader,
      requiredScope: input.actingContextHeader?.toLowerCase() === 'caregiver' ? 'profile' : undefined,
      correlationId: input.correlationId,
    });

    return this.toSafeProfile(ctx, input.correlationId);
  }

  private async toSafeProfile(
    ctx: PortalActingContext,
    correlationId?: string | null,
  ): Promise<PortalSafeProfileDto> {
    const tenant = await this.tenantContext.resolve();
    const detail = await this.patients.findDetailById(ctx.subjectPatientId, tenant.tenantId);
    if (!detail) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.PROFILE_NOT_FOUND),
      );
    }

    this.logger.log(
      this.observability.createFoundationLogFields({
        event: 'profile.read',
        tenantId: tenant.tenantId,
        correlationId,
      }),
    );
    this.activity.emit({
      event: ctx.mode === 'caregiver' ? 'delegated_profile_read' : 'profile_read',
      tenantId: tenant.tenantId,
      correlationId,
    });

    if (ctx.mode === 'caregiver') {
      await this.auditLog.record({
        tenantId: tenant.tenantId,
        branchId: detail.branchId,
        action: 'patient_portal.caregiver.delegated_profile_read',
        resourceId: ctx.subjectPortalAccountId,
        actorId: ctx.actorUserId,
        actorRoles: ctx.actorRoles,
        locale: null,
        reason: null,
        details: {
          actorType: 'patient',
          actingContext: 'caregiver',
          grantId: ctx.grantId ?? '',
          result: 'success',
        },
        correlationId: correlationId ?? null,
      });
    }

    return {
      patientId: detail.id,
      firstName: detail.firstName,
      lastName: detail.lastName,
      dateOfBirth: detail.dateOfBirth,
      gender: detail.gender,
      localeHint: null,
      actingContext: ctx.mode,
    };
  }
}
