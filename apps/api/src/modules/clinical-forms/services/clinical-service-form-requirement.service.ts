import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  CLINICAL_FORMS_AUDIT_LOG,
  ClinicalFormsAuditLog,
} from '../ports/clinical-forms-audit-log.port';
import {
  CLINICAL_FORM_KINDS,
  assertCanonicalClinicalService,
} from './clinical-form-reference.validation';

@Injectable()
export class ClinicalServiceFormRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(CLINICAL_FORMS_AUDIT_LOG) private readonly audit: ClinicalFormsAuditLog,
  ) {}

  async upsert(input: {
    clinicalServiceId: string;
    formKind: string;
    required?: boolean;
    active?: boolean;
    actorId: string;
  }) {
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.clinicalServiceId?.trim() || !input.formKind?.trim()) {
      throw new BadRequestException('clinicalServiceId and formKind are required');
    }
    if (!CLINICAL_FORM_KINDS.includes(input.formKind as (typeof CLINICAL_FORM_KINDS)[number])) {
      throw new BadRequestException(`Invalid form kind: ${input.formKind}`);
    }
    await assertCanonicalClinicalService(this.prisma, tenantId, input.clinicalServiceId);

    const row = await this.prisma.clinicalServiceFormRequirement.upsert({
      where: {
        tenantId_clinicalServiceId_formKind: {
          tenantId,
          clinicalServiceId: input.clinicalServiceId,
          formKind: input.formKind,
        },
      },
      create: {
        id: randomUUID(),
        tenantId,
        clinicalServiceId: input.clinicalServiceId,
        formKind: input.formKind,
        required: input.required ?? true,
        active: input.active ?? true,
      },
      update: {
        required: input.required ?? true,
        active: input.active ?? true,
      },
    });

    await this.audit.record({
      tenantId,
      action: 'clinical_forms.requirement.upsert',
      resourceId: row.id,
      actorId: input.actorId,
      actorRoles: [],
      descriptionEn: `Upserted form requirement ${input.formKind}`,
      descriptionAr: `تم تحديث متطلب النموذج ${input.formKind}`,
      details: {
        clinicalServiceId: input.clinicalServiceId,
        formKind: input.formKind,
        required: row.required,
        active: row.active,
      },
    });

    return row;
  }

  async list(clinicalServiceId?: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return this.prisma.clinicalServiceFormRequirement.findMany({
      where: {
        tenantId,
        ...(clinicalServiceId ? { clinicalServiceId } : {}),
      },
      orderBy: [{ clinicalServiceId: 'asc' }, { formKind: 'asc' }],
    });
  }

  async deactivate(id: string, actorId: string) {
    if (!actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const existing = await this.prisma.clinicalServiceFormRequirement.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Form requirement not found');
    const row = await this.prisma.clinicalServiceFormRequirement.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.record({
      tenantId,
      action: 'clinical_forms.requirement.deactivate',
      resourceId: id,
      actorId,
      actorRoles: [],
      descriptionEn: 'Deactivated form requirement',
      descriptionAr: 'تم إلغاء تفعيل متطلب النموذج',
    });
    return row;
  }
}
