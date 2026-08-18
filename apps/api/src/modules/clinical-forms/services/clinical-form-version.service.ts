import {

  BadRequestException,

  ConflictException,

  ForbiddenException,

  Inject,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { randomUUID } from 'crypto';

import { PrismaService } from '../../../infrastructure/prisma.service';

import { TenantContextService } from '../../../infrastructure/tenant-context.service';

import {

  CLINICAL_FORMS_AUDIT_LOG,

  ClinicalFormsAuditLog,

} from '../ports/clinical-forms-audit-log.port';



const TEMPLATE_LOCK_NAMESPACE = 'phase48:clinical_form_template:';



@Injectable()

export class ClinicalFormVersionService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly tenantContext: TenantContextService,

    @Inject(CLINICAL_FORMS_AUDIT_LOG) private readonly audit: ClinicalFormsAuditLog,

  ) {}



  async createDraft(input: {

    templateId: string;

    contentEn: string;

    contentAr: string;

    actorId: string;

  }) {

    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');

    const tenant = await this.tenantContext.resolve();

    const tenantId = tenant.tenantId;

    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');



    return this.prisma.$transaction(async (tx) => {

      await this.lockTemplateForMutation(tx, input.templateId, tenantId);



      const latest = await tx.clinicalFormVersion.findFirst({

        where: { templateId: input.templateId },

        orderBy: { version: 'desc' },

        select: { version: true },

      });

      const version = (latest?.version ?? 0) + 1;

      const id = randomUUID();

      try {

        return await tx.clinicalFormVersion.create({

          data: {

            id,

            templateId: input.templateId,

            version,

            status: 'DRAFT',

            contentEn: input.contentEn ?? '',

            contentAr: input.contentAr ?? '',

          },

        });

      } catch (err) {

        if (this.isUniqueVersionConflict(err)) {

          throw new ConflictException(

            'Concurrent draft creation detected; retry the version create operation',

          );

        }

        throw err;

      }

    });

  }



  async publish(versionId: string, actorId: string) {

    if (!actorId?.trim()) throw new BadRequestException('Authenticated actor is required');

    const tenant = await this.tenantContext.resolve();

    const tenantId = tenant.tenantId;

    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');



    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      try {

        return await this.publishOnce(versionId, actorId, tenantId);

      } catch (err) {

        if (attempt < maxAttempts && this.isPublishedUniqueConflict(err)) {

          continue;

        }

        if (this.isPublishedUniqueConflict(err)) {

          throw new ConflictException(

            'Concurrent publish detected; only one published version may exist per template',

          );

        }

        throw err;

      }

    }

    throw new ConflictException('Concurrent publish could not be completed');

  }



  private async publishOnce(versionId: string, actorId: string, tenantId: string) {

    return this.prisma.$transaction(async (tx) => {

      const version = await tx.clinicalFormVersion.findFirst({

        where: { id: versionId },

        include: { template: true },

      });

      if (!version) throw new NotFoundException('Clinical form version not found');

      if (version.template.tenantId == null) {

        throw new ForbiddenException('Platform clinical form packs are tenant read-only');

      }

      if (version.template.tenantId !== tenantId) {

        throw new NotFoundException('Clinical form version not found');

      }

      if (version.status !== 'DRAFT') {

        throw new BadRequestException('Only DRAFT versions can be published');

      }

      if (!version.contentEn?.trim() || !version.contentAr?.trim()) {

        throw new BadRequestException('contentEn and contentAr must be non-empty to publish');

      }



      await this.lockTemplateForMutation(tx, version.templateId, tenantId);



      const current = await tx.clinicalFormVersion.findFirst({

        where: { id: versionId },

        select: { id: true, status: true, templateId: true, version: true },

      });

      if (!current || current.status !== 'DRAFT') {

        throw new BadRequestException('Only DRAFT versions can be published');

      }



      const now = new Date();

      await tx.clinicalFormVersion.updateMany({

        where: {

          templateId: current.templateId,

          status: 'PUBLISHED',

          id: { not: versionId },

        },

        data: { status: 'SUPERSEDED' },

      });

      const row = await tx.clinicalFormVersion.update({

        where: { id: versionId },

        data: {

          status: 'PUBLISHED',

          publishedAt: now,

          publishedByUserId: actorId,

        },

      });

      await this.audit.recordInTransaction(tx, {

        tenantId,

        action: 'clinical_forms.version.publish',

        resourceId: versionId,

        actorId,

        actorRoles: [],

        descriptionEn: `Published clinical form version ${current.version}`,

        descriptionAr: `تم نشر إصدار النموذج السريري ${current.version}`,

        details: { templateId: current.templateId, version: current.version },

      });

      return row;

    });

  }



  /** Serialize createDraft/publish for a template across app instances. */

  private async lockTemplateForMutation(

    tx: Prisma.TransactionClient,

    templateId: string,

    tenantId: string,

  ): Promise<void> {

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${TEMPLATE_LOCK_NAMESPACE + templateId}))`;

    const rows = await tx.$queryRaw<Array<{ id: string; tenantId: string | null }>>`

      SELECT id, "tenantId"

      FROM clinical_form_templates

      WHERE id = ${templateId}::uuid

      FOR UPDATE

    `;

    const template = rows[0];

    if (!template) throw new NotFoundException('Clinical form template not found');

    if (template.tenantId == null) {

      throw new ForbiddenException('Platform clinical form packs are tenant read-only');

    }

    if (template.tenantId !== tenantId) {

      throw new NotFoundException('Clinical form template not found');

    }

  }



  private isUniqueVersionConflict(err: unknown): boolean {

    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

  }



  private isPublishedUniqueConflict(err: unknown): boolean {

    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {

      return false;

    }

    const target = err.meta?.target;

    if (Array.isArray(target)) {

      return target.some((t) => String(t).includes('one_published'));

    }

    return String(target ?? '').includes('one_published');

  }

}
