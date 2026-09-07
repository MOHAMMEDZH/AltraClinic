import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  CLINICAL_FORMS_AUDIT_LOG,
  ClinicalFormsAuditLog,
} from '../ports/clinical-forms-audit-log.port';

import { CLINICAL_FORM_KINDS } from './clinical-form-reference.validation';

@Injectable()
export class ClinicalFormTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(CLINICAL_FORMS_AUDIT_LOG) private readonly audit: ClinicalFormsAuditLog,
  ) {}

  async create(input: {
    kind: string;
    stableKey: string;
    nameEn: string;
    nameAr?: string | null;
    actorId: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    if (!CLINICAL_FORM_KINDS.includes(input.kind as (typeof CLINICAL_FORM_KINDS)[number])) {
      throw new BadRequestException(`Invalid form kind: ${input.kind}`);
    }
    const stableKey = input.stableKey?.trim();
    const nameEn = input.nameEn?.trim();
    if (!stableKey || !nameEn) throw new BadRequestException('stableKey and nameEn are required');

    const id = randomUUID();
    const row = await this.prisma.clinicalFormTemplate.create({
      data: {
        id,
        tenantId,
        kind: input.kind,
        stableKey,
        status: 'DRAFT',
        nameEn,
        nameAr: input.nameAr?.trim() || null,
        createdByUserId: input.actorId,
      },
    });

    await this.audit.record({
      tenantId,
      action: 'clinical_forms.template.create',
      resourceId: row.id,
      actorId: input.actorId,
      actorRoles: [],
      descriptionEn: `Created clinical form template ${stableKey}`,
      descriptionAr: `تم إنشاء قالب نموذج سريري ${stableKey}`,
      details: { kind: input.kind, stableKey },
    });

    return row;
  }

  async list(kind?: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return this.prisma.clinicalFormTemplate.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ kind: 'asc' }, { nameEn: 'asc' }],
    });
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const row = await this.prisma.clinicalFormTemplate.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Clinical form template not found');
    return row;
  }

  async activate(id: string, actorId: string) {
    if (!actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const existing = await this.prisma.clinicalFormTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Clinical form template not found');
    const row = await this.prisma.clinicalFormTemplate.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await this.audit.record({
      tenantId,
      action: 'clinical_forms.template.activate',
      resourceId: id,
      actorId,
      actorRoles: [],
      descriptionEn: `Activated clinical form template`,
      descriptionAr: `تم تفعيل قالب النموذج السريري`,
    });
    return row;
  }
}
