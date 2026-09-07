import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  CLINICAL_FORMS_AUDIT_LOG,
  ClinicalFormsAuditLog,
} from '../ports/clinical-forms-audit-log.port';
import {
  CLINICAL_FORM_SIGN_METHODS,
  assertCanonicalClinicalService,
  assertTenantAppointment,
  assertTenantPatient,
} from './clinical-form-reference.validation';

@Injectable()
export class PatientFormInstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(CLINICAL_FORMS_AUDIT_LOG) private readonly audit: ClinicalFormsAuditLog,
  ) {}

  async createDraft(input: {
    patientId: string;
    versionId: string;
    appointmentId?: string | null;
    clinicalServiceId?: string | null;
    actorId: string;
  }) {
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const version = await this.prisma.clinicalFormVersion.findFirst({
      where: { id: input.versionId, status: 'PUBLISHED' },
      include: { template: true },
    });
    if (!version) throw new NotFoundException('Published clinical form version not found');
    if (version.template.tenantId && version.template.tenantId !== tenantId) {
      throw new NotFoundException('Published clinical form version not found');
    }

    const patient = await assertTenantPatient(this.prisma, tenantId, input.patientId);

    if (input.clinicalServiceId?.trim()) {
      await assertCanonicalClinicalService(this.prisma, tenantId, input.clinicalServiceId);
    }
    if (input.appointmentId?.trim()) {
      await assertTenantAppointment(this.prisma, tenantId, input.appointmentId, {
        patientId: patient.id,
        clinicalServiceId: input.clinicalServiceId ?? null,
      });
    }

    return this.prisma.patientFormInstance.create({
      data: {
        id: randomUUID(),
        tenantId,
        patientId: input.patientId,
        versionId: input.versionId,
        appointmentId: input.appointmentId ?? null,
        clinicalServiceId: input.clinicalServiceId ?? null,
        status: 'DRAFT',
        createdByUserId: input.actorId,
      },
    });
  }

  async sign(input: {
    instanceId: string;
    actorId: string;
    signerPatientId?: string | null;
    method?: string | null;
  }) {
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const instance = await this.prisma.patientFormInstance.findFirst({
      where: { id: input.instanceId, tenantId },
      include: { version: true },
    });
    if (!instance) throw new NotFoundException('Patient form instance not found');
    if (instance.status === 'SIGNED') {
      throw new BadRequestException('Form instance is already signed');
    }
    if (instance.status === 'VOID') {
      throw new BadRequestException('Void form instance cannot be signed');
    }
    if (instance.version.status !== 'PUBLISHED' && instance.version.status !== 'SUPERSEDED') {
      throw new BadRequestException('Version must be published (or superseded) to sign');
    }

    const method = (input.method ?? 'STAFF_WITNESSED').trim();
    if (!CLINICAL_FORM_SIGN_METHODS.includes(method as (typeof CLINICAL_FORM_SIGN_METHODS)[number])) {
      throw new BadRequestException(`Invalid signing method: ${method}`);
    }

    const signerPatientId = input.signerPatientId?.trim() || null;
    if (method === 'PATIENT_SELF' && !signerPatientId) {
      throw new BadRequestException('signerPatientId is required for PATIENT_SELF signing');
    }
    if (signerPatientId) {
      const signer = await assertTenantPatient(this.prisma, tenantId, signerPatientId);
      // No approved guardian/dependent signatory model: only the form patient may be recorded.
      if (signer.id !== instance.patientId) {
        throw new BadRequestException('signerPatientId must match the form patient (self-sign only)');
      }
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const signed = await tx.patientFormInstance.update({
        where: { id: instance.id },
        data: {
          status: 'SIGNED',
          signedAt: now,
          signerUserId: input.actorId,
          signerPatientId,
          method,
          signedContentEn: instance.version.contentEn,
          signedContentAr: instance.version.contentAr,
        },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        action: 'clinical_forms.instance.sign',
        resourceId: instance.id,
        actorId: input.actorId,
        actorRoles: [],
        descriptionEn: 'Signed patient form instance',
        descriptionAr: 'تم توقيع نموذج المريض',
        details: {
          patientId: instance.patientId,
          versionId: instance.versionId,
          method,
        },
      });
      return signed;
    });
  }

  async voidInstance(input: {
    instanceId: string;
    actorId: string;
    reason: string;
  }) {
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    if (!input.reason?.trim()) throw new BadRequestException('voidReason is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const instance = await this.prisma.patientFormInstance.findFirst({
      where: { id: input.instanceId, tenantId },
    });
    if (!instance) throw new NotFoundException('Patient form instance not found');
    if (instance.status !== 'SIGNED') {
      throw new BadRequestException('Only SIGNED form instances can be voided');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.patientFormInstance.update({
        where: { id: instance.id },
        data: {
          status: 'VOID',
          voidedAt: now,
          voidedByUserId: input.actorId,
          voidReason: input.reason.trim(),
        },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        action: 'clinical_forms.instance.void',
        resourceId: instance.id,
        actorId: input.actorId,
        actorRoles: [],
        descriptionEn: 'Voided signed patient form instance',
        descriptionAr: 'تم إبطال نموذج المريض الموقّع',
        details: {
          patientId: instance.patientId,
          versionId: instance.versionId,
          voidReason: input.reason.trim(),
        },
      });
      return voided;
    });
  }
}
