import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { WAVE_E_AUDIT_LOG, WaveEAuditLog } from '../ports/wave-e-audit-log.port';
import {
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantPatient,
  assertUuid,
} from './wave-e-reference.validation';

const PRE_POST_KINDS = new Set(['PRE_CARE', 'POST_CARE']);

/**
 * P1-09 / R2-B4 / R3-B3 — Pre/post-care via unified ClinicalForm architecture (AR-09).
 * Does NOT create/publish ClinicalFormTemplate or ClinicalFormVersion.
 * Visibility matches PatientFormInstanceService / ClinicalFormTemplateService:
 *   template.tenantId == current tenant OR template.tenantId == null (platform pack).
 * Precedence when auto-resolving: tenant-owned PUBLISHED wins over platform pack.
 */
@Injectable()
export class PrePostCareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_E_AUDIT_LOG) private readonly audit: WaveEAuditLog,
  ) {}

  async assertInstanceKind(input: {
    instanceId: string;
    expectedKind: 'PRE_CARE' | 'POST_CARE';
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!PRE_POST_KINDS.has(input.expectedKind)) {
      throw new BadRequestException('expectedKind must be PRE_CARE or POST_CARE');
    }
    const instanceId = assertUuid(input.instanceId, 'instanceId');

    return this.prisma.withPlatformBypass(async (tx) => {
      const instance = await tx.patientFormInstance.findFirst({
        where: { id: instanceId, tenantId },
        include: {
          version: { include: { template: true } },
        },
      });
      if (!instance) throw new NotFoundException('PatientFormInstance not found');
      const kind = instance.version?.template?.kind;
      if (kind !== input.expectedKind) {
        throw new BadRequestException(
          `PatientFormInstance kind is ${kind ?? 'unknown'}, expected ${input.expectedKind}`,
        );
      }
      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'pre_post_care.assert',
        resourceId: instanceId,
        descriptionEn: `Verified ${input.expectedKind} form instance`,
        details: { kind: input.expectedKind },
      });
      return {
        id: instance.id,
        kind,
        status: instance.status,
        patientId: instance.patientId,
        appointmentId: instance.appointmentId,
        clinicalServiceId: instance.clinicalServiceId,
        versionId: instance.versionId,
      };
    });
  }

  listSupportedKinds() {
    return ['PRE_CARE', 'POST_CARE'] as const;
  }

  /**
   * Create PatientFormInstance against an existing PUBLISHED ClinicalFormVersion.
   * Never creates/publishes templates or versions in the patient workflow.
   */
  async createInstance(input: {
    kind: 'PRE_CARE' | 'POST_CARE';
    patientId: string;
    /** Optional explicit published version; otherwise resolve with tenant-override precedence. */
    versionId?: string | null;
    appointmentId?: string | null;
    clinicalServiceId?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    if (!PRE_POST_KINDS.has(input.kind)) {
      throw new BadRequestException('kind must be PRE_CARE or POST_CARE');
    }

    const patientId = assertUuid(input.patientId, 'patientId');
    const appointmentId = input.appointmentId ? assertUuid(input.appointmentId, 'appointmentId') : null;
    const clinicalServiceId = input.clinicalServiceId
      ? assertUuid(input.clinicalServiceId, 'clinicalServiceId')
      : null;

    return this.prisma.withPlatformBypass(async (tx) => {
      const templateCountBefore = await tx.clinicalFormTemplate.count({
        where: { OR: [{ tenantId }, { tenantId: null }] },
      });
      const versionCountBefore = await tx.clinicalFormVersion.count({
        where: { template: { OR: [{ tenantId }, { tenantId: null }] } },
      });
      const platformTemplateIdsBefore = (
        await tx.clinicalFormTemplate.findMany({
          where: { tenantId: null, kind: input.kind },
          select: { id: true, status: true },
          orderBy: { id: 'asc' },
        })
      ).map((r) => `${r.id}:${r.status}`);
      const platformVersionIdsBefore = (
        await tx.clinicalFormVersion.findMany({
          where: { template: { tenantId: null, kind: input.kind } },
          select: { id: true, status: true, version: true },
          orderBy: { id: 'asc' },
        })
      ).map((r) => `${r.id}:${r.status}:${r.version}`);

      await assertTenantPatient(tx, tenantId, patientId);
      if (clinicalServiceId) {
        await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
      }
      if (appointmentId) {
        const appt = await assertTenantAppointment(tx, tenantId, appointmentId);
        if (appt.patientId !== patientId) {
          throw new BadRequestException('appointmentId patient does not match patientId');
        }
        if (clinicalServiceId && appt.clinicalServiceId && appt.clinicalServiceId !== clinicalServiceId) {
          throw new BadRequestException(
            'appointmentId clinicalServiceId does not match clinicalServiceId',
          );
        }
      }

      let version: {
        id: string;
        status: string;
        templateId: string;
        template: { id: string; tenantId: string | null; kind: string };
      } | null = null;

      if (input.versionId) {
        const versionId = assertUuid(input.versionId, 'versionId');
        version = await tx.clinicalFormVersion.findFirst({
          where: { id: versionId },
          include: { template: true },
        });
        if (!version) {
          throw new NotFoundException('ClinicalFormVersion not found');
        }
        // Same visibility as PatientFormInstanceService.createDraft
        if (version.template.tenantId && version.template.tenantId !== tenantId) {
          throw new BadRequestException(
            'ClinicalFormVersion is not visible to the current tenant',
          );
        }
        if (version.template.kind !== input.kind) {
          throw new BadRequestException(
            `ClinicalFormVersion kind is ${version.template.kind}, expected ${input.kind}`,
          );
        }
        if (version.status !== 'PUBLISHED') {
          throw new BadRequestException(
            `ClinicalFormVersion must be PUBLISHED (was ${version.status})`,
          );
        }
      } else {
        // Tenant override wins over platform pack (deterministic ClinicalForm precedence)
        version = await tx.clinicalFormVersion.findFirst({
          where: {
            status: 'PUBLISHED',
            template: { tenantId, kind: input.kind, status: 'ACTIVE' },
          },
          include: { template: true },
          orderBy: { version: 'desc' },
        });
        if (!version) {
          version = await tx.clinicalFormVersion.findFirst({
            where: {
              status: 'PUBLISHED',
              template: { tenantId: null, kind: input.kind, status: 'ACTIVE' },
            },
            include: { template: true },
            orderBy: { version: 'desc' },
          });
        }
        if (!version) {
          throw new BadRequestException(
            `No PUBLISHED ${input.kind} ClinicalFormVersion exists for tenant or platform pack; administer forms via ClinicalForm authority first`,
          );
        }
      }

      const instance = await tx.patientFormInstance.create({
        data: {
          id: randomUUID(),
          tenantId,
          patientId,
          versionId: version.id,
          appointmentId,
          clinicalServiceId,
          status: 'DRAFT',
          createdByUserId: input.actorId,
        },
      });

      const templateCountAfter = await tx.clinicalFormTemplate.count({
        where: { OR: [{ tenantId }, { tenantId: null }] },
      });
      const versionCountAfter = await tx.clinicalFormVersion.count({
        where: { template: { OR: [{ tenantId }, { tenantId: null }] } },
      });
      if (templateCountAfter !== templateCountBefore || versionCountAfter !== versionCountBefore) {
        throw new BadRequestException(
          'Pre/post care patient workflow must not create ClinicalFormTemplate or ClinicalFormVersion',
        );
      }

      const platformTemplateIdsAfter = (
        await tx.clinicalFormTemplate.findMany({
          where: { tenantId: null, kind: input.kind },
          select: { id: true, status: true },
          orderBy: { id: 'asc' },
        })
      ).map((r) => `${r.id}:${r.status}`);
      const platformVersionIdsAfter = (
        await tx.clinicalFormVersion.findMany({
          where: { template: { tenantId: null, kind: input.kind } },
          select: { id: true, status: true, version: true },
          orderBy: { id: 'asc' },
        })
      ).map((r) => `${r.id}:${r.status}:${r.version}`);
      if (platformTemplateIdsAfter.join('|') !== platformTemplateIdsBefore.join('|')) {
        throw new BadRequestException('Pre/post care must not mutate platform ClinicalFormTemplate rows');
      }
      if (platformVersionIdsAfter.join('|') !== platformVersionIdsBefore.join('|')) {
        throw new BadRequestException('Pre/post care must not mutate platform ClinicalFormVersion rows');
      }

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'pre_post_care.instance.create',
        resourceId: instance.id,
        descriptionEn: `Created ${input.kind} form instance from published ClinicalFormVersion`,
        details: {
          kind: input.kind,
          templateId: version.templateId,
          versionId: version.id,
          templateScope: version.template.tenantId == null ? 'platform_pack' : 'tenant',
        },
      });

      return {
        id: instance.id,
        kind: input.kind,
        status: instance.status,
        patientId: instance.patientId,
        appointmentId: instance.appointmentId,
        clinicalServiceId: instance.clinicalServiceId,
        versionId: version.id,
        templateId: version.templateId,
      };
    });
  }
}
