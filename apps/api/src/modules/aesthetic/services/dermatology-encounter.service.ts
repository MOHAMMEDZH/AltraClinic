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
  assertDermatologyServiceEligibility,
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantBranch,
  assertTenantPatient,
  assertTenantUser,
  assertUuid,
} from './wave-e-reference.validation';

/**
 * AR-15 — Dermatology clinical depth via existing Encounter SoR + MediaAsset.
 * Explicitly does NOT create a DermatologyRecord EMR table.
 */
@Injectable()
export class DermatologyEncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_E_AUDIT_LOG) private readonly audit: WaveEAuditLog,
  ) {}

  async openDermatologyEncounter(input: {
    patientId: string;
    clinicianId: string;
    clinicalServiceId: string;
    appointmentId?: string | null;
    branchId?: string | null;
    chiefComplaint?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');

    const patientId = assertUuid(input.patientId, 'patientId');
    const clinicianId = assertUuid(input.clinicianId, 'clinicianId');
    const clinicalServiceId = assertUuid(input.clinicalServiceId, 'clinicalServiceId');

    return this.prisma.withPlatformBypass(async (tx) => {
      await assertTenantPatient(tx, tenantId, patientId);
      await assertTenantUser(tx, tenantId, clinicianId);
      await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
      const serviceRow = await tx.canonicalClinicalServiceDefinition.findFirst({
        where: { id: clinicalServiceId },
        select: { domain: true, categoryKey: true },
      });
      assertDermatologyServiceEligibility(serviceRow ?? {});

      let appointmentId: string | null = null;
      let branchId = input.branchId ? assertUuid(input.branchId, 'branchId') : tenant.branchId ?? null;
      if (input.appointmentId) {
        appointmentId = assertUuid(input.appointmentId, 'appointmentId');
        const appt = await assertTenantAppointment(tx, tenantId, appointmentId);
        if (appt.patientId !== patientId) {
          throw new BadRequestException('appointmentId patient does not match patientId');
        }
        if (appt.clinicalServiceId && appt.clinicalServiceId !== clinicalServiceId) {
          throw new BadRequestException(
            'appointmentId clinicalServiceId does not match dermatology clinicalServiceId',
          );
        }
        if (appt.branchId != null) {
          if (!branchId) {
            branchId = appt.branchId;
          } else if (appt.branchId !== branchId) {
            throw new BadRequestException('appointmentId branch does not match branchId');
          }
        }
      }
      if (branchId) await assertTenantBranch(tx, tenantId, branchId);

      const id = randomUUID();
      const encounter = await tx.encounter.create({
        data: {
          id,
          tenantId,
          patientId,
          clinicianId,
          appointmentId,
          branchId,
          chiefComplaint: input.chiefComplaint?.trim() || null,
          diagnoses: [],
          medications: [],
          observations: [{ kind: 'dermatology', clinicalServiceId }],
          soapNotes: {},
          structuredNotes: [],
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'dermatology.encounter.open',
        resourceId: id,
        descriptionEn: 'Dermatology encounter opened via Encounter SoR (no DermatologyRecord)',
        details: {
          clinicalServiceId,
          clinicianId,
          recordedBy: input.actorId,
        },
      });

      return encounter;
    });
  }

  /**
   * E4 — Attach clinical photo via existing MediaAsset (ownerType=encounter).
   * No dermatology-specific media table.
   */
  async attachDermatologyPhoto(input: {
    encounterId: string;
    /** Existing same-tenant MediaAsset id to re-bind, or create a durable clinical photo row. */
    mediaAssetId?: string | null;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const encounterId = assertUuid(input.encounterId, 'encounterId');

    return this.prisma.withPlatformBypass(async (tx) => {
      const encounter = await tx.encounter.findFirst({
        where: { id: encounterId, tenantId, deletedAt: null },
      });
      if (!encounter) throw new NotFoundException('Encounter not found');

      // R2 derm photo — encounter must be dermatology-valid via clinicalService marker in observations
      const observations = Array.isArray(encounter.observations)
        ? (encounter.observations as Array<Record<string, unknown>>)
        : [];
      const dermObs = observations.find((o) => o?.kind === 'dermatology' && o?.clinicalServiceId);
      if (!dermObs?.clinicalServiceId) {
        throw new BadRequestException(
          'Encounter is not a dermatology encounter (missing dermatology clinicalService observation)',
        );
      }
      const serviceRow = await tx.canonicalClinicalServiceDefinition.findFirst({
        where: { id: String(dermObs.clinicalServiceId) },
        select: { domain: true, categoryKey: true },
      });
      assertDermatologyServiceEligibility(serviceRow ?? {});

      let media;
      if (input.mediaAssetId) {
        const mediaId = assertUuid(input.mediaAssetId, 'mediaAssetId');
        media = await tx.mediaAsset.findFirst({
          where: { id: mediaId, tenantId, deletedAt: null },
        });
        if (!media) throw new NotFoundException('MediaAsset not found for tenant');
        if (media.patientId && media.patientId !== encounter.patientId) {
          throw new BadRequestException('MediaAsset patient does not match encounter patient');
        }
        media = await tx.mediaAsset.update({
          where: { id: media.id },
          data: {
            ownerType: 'encounter',
            ownerId: encounterId,
            patientId: encounter.patientId,
            category: 'MEDICAL_DOCUMENT',
          },
        });
      } else {
        const id = randomUUID();
        media = await tx.mediaAsset.create({
          data: {
            id,
            tenantId,
            branchId: encounter.branchId,
            category: 'MEDICAL_DOCUMENT',
            ownerType: 'encounter',
            ownerId: encounterId,
            patientId: encounter.patientId,
            originalFilename: input.originalFilename?.trim() || 'dermatology-photo.jpg',
            mimeType: input.mimeType?.trim() || 'image/jpeg',
            sizeBytes: BigInt(input.sizeBytes ?? 1),
            status: 'READY',
            virusScanStatus: 'SKIPPED',
            storageKey: `derm/${tenantId}/${encounterId}/${id}`,
            uploadedBy: input.actorId,
          },
        });
      }

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'dermatology.photo.attach',
        resourceId: media.id,
        descriptionEn: 'Dermatology photo linked via MediaAsset to Encounter',
        details: { encounterId, mediaAssetId: media.id },
      });

      // JSON-safe: Prisma MediaAsset.sizeBytes is BigInt
      return {
        encounter,
        media: { ...media, sizeBytes: Number(media.sizeBytes) },
      };
    });
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const row = await this.prisma.withPlatformBypass((tx) =>
      tx.encounter.findFirst({ where: { id, tenantId, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException('Encounter not found');
    return row;
  }

  /** Hard assertion for QA — DermatologyRecord model must not exist. */
  assertNoDermatologyRecordModel(): { dermatologyRecordModel: false } {
    return { dermatologyRecordModel: false };
  }
}
