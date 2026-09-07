import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { WAVE_E_AUDIT_LOG, WaveEAuditLog } from '../ports/wave-e-audit-log.port';
import {
  assertDeviceTypeSchemaKey,
  assertOpaqueExternalDeviceId,
  assertReadableClinicalService,
  assertTenantBeautyAnnotation,
  assertTenantBranch,
  assertTenantEncounter,
  assertTenantPatient,
  assertTenantUser,
  assertUuid,
} from './wave-e-reference.validation';

@Injectable()
export class DeviceTreatmentRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_E_AUDIT_LOG) private readonly audit: WaveEAuditLog,
  ) {}

  async create(input: {
    deviceType: string;
    /** Opaque external device identifier — not an internal FK. */
    deviceId?: string | null;
    clinicalServiceId: string;
    bodyArea?: string | null;
    parameterPayload?: Record<string, unknown>;
    parameterSchemaKey: string;
    patientId: string;
    /** Clinical provider/performer — not inferred from authenticated recorder. */
    providerId: string;
    branchId?: string | null;
    recordedAt?: string | null;
    beautyAnnotationId?: string | null;
    encounterId?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');

    const parameterSchemaKey = assertDeviceTypeSchemaKey(
      input.deviceType,
      input.parameterSchemaKey,
    );
    const controlledType = input.deviceType.trim().toLowerCase();
    const patientId = assertUuid(input.patientId, 'patientId');
    const providerId = assertUuid(input.providerId, 'providerId');
    const clinicalServiceId = assertUuid(input.clinicalServiceId, 'clinicalServiceId');
    const opaqueDeviceId = assertOpaqueExternalDeviceId(input.deviceId);

    return this.prisma.withPlatformBypass(async (tx) => {
      await assertTenantPatient(tx, tenantId, patientId);
      await assertTenantUser(tx, tenantId, providerId);
      await assertTenantUser(tx, tenantId, input.actorId);
      await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
      let branchId = input.branchId ? assertUuid(input.branchId, 'branchId') : tenant.branchId ?? null;
      if (branchId) await assertTenantBranch(tx, tenantId, branchId);
      let encounterId: string | null = null;
      if (input.encounterId) {
        encounterId = assertUuid(input.encounterId, 'encounterId');
        const enc = await assertTenantEncounter(tx, tenantId, encounterId);
        if (enc.patientId !== patientId) {
          throw new BadRequestException('encounterId patient does not match patientId');
        }
        if (enc.branchId != null) {
          if (!branchId) {
            branchId = enc.branchId;
          } else if (enc.branchId !== branchId) {
            throw new BadRequestException('encounterId branch does not match branchId');
          }
        }
      }
      let beautyAnnotationId: string | null = null;
      if (input.beautyAnnotationId) {
        beautyAnnotationId = assertUuid(input.beautyAnnotationId, 'beautyAnnotationId');
        await assertTenantBeautyAnnotation(tx, tenantId, beautyAnnotationId, patientId);
      }

      const id = randomUUID();
      const row = await tx.deviceTreatmentRecord.create({
        data: {
          id,
          tenantId,
          deviceType: controlledType,
          deviceId: opaqueDeviceId,
          clinicalServiceId,
          bodyArea: input.bodyArea?.trim() || null,
          parameterPayload: (input.parameterPayload ?? {}) as Prisma.InputJsonValue,
          parameterSchemaKey,
          patientId,
          providerId,
          branchId,
          recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
          recordedBy: input.actorId,
          beautyAnnotationId,
          encounterId,
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'device_treatment.create',
        resourceId: id,
        descriptionEn: 'Device treatment record created',
        details: {
          deviceType: controlledType,
          parameterSchemaKey,
          providerId,
          recordedBy: input.actorId,
        },
      });
      return row;
    });
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const row = await this.prisma.withPlatformBypass((tx) =>
      tx.deviceTreatmentRecord.findFirst({ where: { id, tenantId, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException('Device treatment record not found');
    return row;
  }

  /** Audited correction of parameter payload (append/correct+audit). */
  async correct(input: {
    id: string;
    parameterPayload: Record<string, unknown>;
    reason: string;
    actorId: string;
    actorRoles: string[];
    /** Optional: cannot silently switch to incompatible schema key. */
    parameterSchemaKey?: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.reason?.trim()) throw new BadRequestException('correction reason is required');

    return this.prisma.withPlatformBypass(async (tx) => {
      const row = await tx.deviceTreatmentRecord.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Device treatment record not found');
      await assertTenantUser(tx, tenantId, input.actorId);

      let nextKey = row.parameterSchemaKey;
      if (input.parameterSchemaKey != null) {
        nextKey = assertDeviceTypeSchemaKey(row.deviceType, input.parameterSchemaKey);
      } else {
        assertDeviceTypeSchemaKey(row.deviceType, row.parameterSchemaKey);
      }

      const previous = row.parameterPayload;
      const updated = await tx.deviceTreatmentRecord.update({
        where: { id: row.id },
        data: {
          parameterPayload: input.parameterPayload as Prisma.InputJsonValue,
          parameterSchemaKey: nextKey,
          correctionReason: input.reason.trim().slice(0, 500),
          correctedAt: new Date(),
          correctedBy: input.actorId,
        },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'device_treatment.correct',
        resourceId: row.id,
        descriptionEn: 'Device treatment parameters corrected',
        details: {
          reason: input.reason.trim(),
          previous: JSON.stringify(previous),
          parameterSchemaKey: nextKey,
        },
      });
      return updated;
    });
  }
}
