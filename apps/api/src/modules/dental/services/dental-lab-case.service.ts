import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DentalLabCaseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { WAVE_D_AUDIT_LOG, WaveDAuditLog } from '../ports/wave-d-audit-log.port';
import {
  LAB_STATUSES,
  LAB_TRANSITIONS,
  assertTenantPatient,
  assertTenantPlanItem,
  assertTenantUser,
  assertUuid,
} from './wave-d-reference.validation';

@Injectable()
export class DentalLabCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_D_AUDIT_LOG) private readonly audit: WaveDAuditLog,
  ) {}

  async create(input: {
    patientId: string;
    providerId: string;
    planItemId?: string | null;
    labVendor: string;
    caseType: string;
    toothOrArch?: string | null;
    shade?: string | null;
    specs?: string | null;
    expectedAt?: string | null;
    notes?: string | null;
    costRef?: string | null;
    branchId?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const patientId = assertUuid(input.patientId, 'patientId');
    const providerId = assertUuid(input.providerId, 'providerId');
    const labVendor = input.labVendor?.trim();
    const caseType = input.caseType?.trim();
    if (!labVendor || !caseType) throw new BadRequestException('labVendor and caseType are required');

    return this.prisma.withPlatformBypass(async (tx) => {
        const patient = await assertTenantPatient(tx, tenantId, patientId);
        const provider = await assertTenantUser(tx, tenantId, providerId);
        if (!provider.isActive) throw new BadRequestException('providerId is inactive');
        let planItemId: string | null = null;
        if (input.planItemId) {
          planItemId = assertUuid(input.planItemId, 'planItemId');
          const item = await assertTenantPlanItem(tx, tenantId, planItemId);
          if (item.phase.plan.patientId !== patient.id) {
            throw new BadRequestException('planItemId does not belong to this patient');
          }
        }
        if (input.branchId) {
          const branchId = assertUuid(input.branchId, 'branchId');
          const branch = await tx.branch.findFirst({
            where: { id: branchId, tenantId, deletedAt: null },
            select: { id: true },
          });
          if (!branch) throw new BadRequestException('branchId does not belong to the current tenant');
        }
        const row = await tx.dentalLabCase.create({
          data: {
            id: randomUUID(),
            tenantId,
            branchId: input.branchId ?? tenant.branchId ?? null,
            patientId,
            providerId,
            planItemId,
            labVendor,
            caseType,
            toothOrArch: input.toothOrArch?.trim() || null,
            shade: input.shade?.trim() || null,
            specs: input.specs?.trim() || null,
            expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
            notes: input.notes?.trim() || null,
            costRef: input.costRef?.trim() || null,
            status: 'DRAFT',
            createdBy: input.actorId,
          },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'dental.lab_case.create',
          resourceId: row.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: `Created dental lab case ${caseType}`,
          descriptionAr: `تم إنشاء حالة مختبر أسنان ${caseType}`,
          details: { patientId, providerId, planItemId },
        });
        return row;
    });
  }

  async list(query: { patientId?: string; status?: string }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (query.status && !LAB_STATUSES.includes(query.status as (typeof LAB_STATUSES)[number])) {
      throw new BadRequestException('Invalid lab status');
    }
    return this.prisma.withPlatformBypass((c) =>
      c.dentalLabCase.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.patientId ? { patientId: assertUuid(query.patientId, 'patientId') } : {}),
          ...(query.status ? { status: query.status as DentalLabCaseStatus } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { attachments: true },
      }),
    );
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const row = await this.prisma.withPlatformBypass((c) =>
      c.dentalLabCase.findFirst({
        where: { id: assertUuid(id, 'id'), tenantId, deletedAt: null },
        include: { attachments: true },
      }),
    );
    if (!row) throw new NotFoundException('Dental lab case not found');
    return row;
  }

  async transition(input: {
    id: string;
    status: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const next = input.status?.toUpperCase();
    if (!LAB_STATUSES.includes(next as (typeof LAB_STATUSES)[number])) {
      throw new BadRequestException('Invalid lab status');
    }
    return this.prisma.withPlatformBypass(async (tx) => {
        const row = await tx.dentalLabCase.findFirst({
          where: { id: assertUuid(input.id, 'id'), tenantId, deletedAt: null },
        });
        if (!row) throw new NotFoundException('Dental lab case not found');
        const allowed = LAB_TRANSITIONS[row.status] ?? [];
        if (!allowed.includes(next)) {
          throw new BadRequestException(`Cannot transition lab case from ${row.status} to ${next}`);
        }
        const now = new Date();
        const updated = await tx.dentalLabCase.update({
          where: { id: row.id },
          data: {
            status: next as DentalLabCaseStatus,
            sentAt: next === 'SENT' ? now : row.sentAt,
            receivedAt: next === 'RECEIVED' ? now : row.receivedAt,
          },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'dental.lab_case.transition',
          resourceId: row.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: `Lab case ${row.status} → ${next}`,
          descriptionAr: `حالة المختبر ${row.status} → ${next}`,
          details: { from: row.status, to: next },
        });
        return updated;
    });
  }

  async attachMedia(input: {
    id: string;
    mediaAssetId: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const mediaAssetId = assertUuid(input.mediaAssetId, 'mediaAssetId');
    return this.prisma.withPlatformBypass(async (tx) => {
        const row = await tx.dentalLabCase.findFirst({
          where: { id: assertUuid(input.id, 'id'), tenantId, deletedAt: null },
        });
        if (!row) throw new NotFoundException('Dental lab case not found');
        const media = await tx.mediaAsset.findFirst({
          where: { id: mediaAssetId, tenantId, deletedAt: null },
          select: { id: true, patientId: true },
        });
        if (!media) throw new NotFoundException('Media asset not found');
        if (media.patientId && media.patientId !== row.patientId) {
          throw new BadRequestException('Media patient does not match lab case patient');
        }
        const att = await tx.dentalLabCaseAttachment.create({
          data: {
            id: randomUUID(),
            tenantId,
            labCaseId: row.id,
            mediaAssetId,
            attachedBy: input.actorId,
          },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'dental.lab_case.attach_media',
          resourceId: att.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Attached media to dental lab case',
          descriptionAr: 'تم إرفاق وسائط بحالة المختبر',
          details: { labCaseId: row.id, mediaAssetId },
        });
        return att;
    });
  }
}
