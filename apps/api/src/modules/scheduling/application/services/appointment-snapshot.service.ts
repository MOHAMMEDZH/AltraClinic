import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AppointmentStatus, ClinicalPricingUnit, Prisma } from '@prisma/client';

export type ResolvedCanonicalCommercial = {
  clinicalServiceId: string;
  stableKey: string;
  displayNameAr: string;
  displayNameEn: string;
  tenantServiceConfigurationId: string | null;
  priceVersionId: string | null;
  pricingUnit: ClinicalPricingUnit;
  currency: string;
  unitPrice: number;
  taxPercent: number;
  quantity: number;
  commercialReason: string | null;
};

@Injectable()
export class AppointmentSnapshotService {
  isConfirmedOrBeyond(status: AppointmentStatus | string): boolean {
    const s = String(status).toUpperCase();
    return (
      s === 'CONFIRMED' ||
      s === 'CHECKED_IN' ||
      s === 'IN_PROGRESS' ||
      s === 'COMPLETED' ||
      s === 'NO_SHOW'
    );
  }

  /**
   * Irreversible commercial lock: once commercialLockedAt is set (first CONFIRMED),
   * ordinary commercial edits remain forbidden even after CANCELLED/NO_SHOW/COMPLETED.
   *
   * Defense-in-depth for legacy CANCELLED rows that reached commercial history
   * (effective snapshot) but were never stamped by earlier migrations.
   */
  isCommercialLocked(params: {
    status: AppointmentStatus | string;
    commercialLockedAt?: Date | string | null;
    effectiveSnapshotRevisionId?: string | null;
  }): boolean {
    if (params.commercialLockedAt) return true;
    if (this.isConfirmedOrBeyond(params.status)) return true;
    const status = String(params.status).toUpperCase();
    if (status === 'CANCELLED' && params.effectiveSnapshotRevisionId) {
      return true;
    }
    return false;
  }

  shouldSetCommercialLock(params: {
    priorStatus: AppointmentStatus | string;
    nextStatus: AppointmentStatus | string;
    commercialLockedAt?: Date | string | null;
  }): boolean {
    if (params.commercialLockedAt) return false;
    if (this.isConfirmedOrBeyond(params.nextStatus)) return true;
    // Transitioning away from confirmed-or-beyond still locks forever.
    return this.isConfirmedOrBeyond(params.priorStatus);
  }

  assertZeroAllowed(unitPrice: number, commercialReason: string | null | undefined) {
    if (unitPrice === 0 && !commercialReason?.trim()) {
      throw new BadRequestException('Zero unitPrice requires commercialReason');
    }
  }

  async captureCanonicalRevision1(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      appointmentId: string;
      actorId: string;
      commercial: ResolvedCanonicalCommercial;
    },
  ) {
    const c = params.commercial;
    this.assertZeroAllowed(c.unitPrice, c.commercialReason);
    if (c.quantity <= 0) throw new BadRequestException('quantity must be > 0');

    const revision = await client.appointmentServiceSnapshotRevision.create({
      data: {
        id: randomUUID(),
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        revisionNumber: 1,
        clinicalServiceId: c.clinicalServiceId,
        stableKey: c.stableKey,
        displayNameAr: c.displayNameAr,
        displayNameEn: c.displayNameEn,
        tenantServiceConfigurationId: c.tenantServiceConfigurationId,
        priceVersionId: c.priceVersionId,
        pricingUnit: c.pricingUnit,
        quantity: c.quantity,
        currency: c.currency,
        unitPrice: c.unitPrice,
        taxPercent: c.taxPercent,
        lineBasisAmount: c.unitPrice * c.quantity,
        commercialReason: c.commercialReason,
        changeReason: null,
        actorId: params.actorId,
        changeCommandContext: 'booking.create',
      },
    });

    await client.appointment.update({
      where: { id: params.appointmentId },
      data: {
        clinicalServiceId: c.clinicalServiceId,
        effectiveSnapshotRevisionId: revision.id,
      },
    });

    return revision;
  }

  async captureLegacySyntheticRevision1(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      appointmentId: string;
      clinicalServiceId: string | null;
      stableKey: string;
      displayNameAr: string;
      displayNameEn: string;
      actorId: string;
    },
  ) {
    const revision = await client.appointmentServiceSnapshotRevision.create({
      data: {
        id: randomUUID(),
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        revisionNumber: 1,
        clinicalServiceId: params.clinicalServiceId,
        stableKey: params.stableKey,
        displayNameAr: params.displayNameAr,
        displayNameEn: params.displayNameEn,
        pricingUnit: ClinicalPricingUnit.PER_VISIT,
        quantity: 1,
        currency: 'SYP',
        unitPrice: 0,
        taxPercent: 0,
        lineBasisAmount: 0,
        commercialReason: params.clinicalServiceId
          ? 'LEGACY_SYNTHETIC_MAPPED'
          : 'LEGACY_UNMAPPED',
        actorId: params.actorId,
        changeCommandContext: 'migration.backfill',
      },
    });
    await client.appointment.update({
      where: { id: params.appointmentId },
      data: { effectiveSnapshotRevisionId: revision.id },
    });
    return revision;
  }

  async appendResolvedCommercialRevision(
    client: Prisma.TransactionClient,
    params: {
      tenantId: string;
      appointmentId: string;
      changeReason: string;
      actorId: string;
      commercial: ResolvedCanonicalCommercial;
      allowPostConfirmCorrection?: boolean;
      appointmentStatus: AppointmentStatus | string;
    },
  ) {
    if (!params.changeReason?.trim()) {
      throw new BadRequestException('changeReason is required for commercial revision');
    }
    const current = await client.appointment.findFirstOrThrow({
      where: { id: params.appointmentId, tenantId: params.tenantId },
    });
    const locked = this.isCommercialLocked({
      status: params.appointmentStatus,
      commercialLockedAt: current.commercialLockedAt,
    });
    if (locked && !params.allowPostConfirmCorrection) {
      throw new ConflictException('CONFIRMED appointment commercial identity is locked');
    }
    const prior = current.effectiveSnapshotRevisionId
      ? await client.appointmentServiceSnapshotRevision.findUniqueOrThrow({
          where: { id: current.effectiveSnapshotRevisionId },
        })
      : null;
    const nextNumber = (prior?.revisionNumber ?? 0) + 1;
    const c = params.commercial;
    this.assertZeroAllowed(c.unitPrice, c.commercialReason);

    const revision = await client.appointmentServiceSnapshotRevision.create({
      data: {
        id: randomUUID(),
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        revisionNumber: nextNumber,
        previousRevisionId: prior?.id ?? null,
        clinicalServiceId: c.clinicalServiceId,
        stableKey: c.stableKey,
        displayNameAr: c.displayNameAr,
        displayNameEn: c.displayNameEn,
        tenantServiceConfigurationId: c.tenantServiceConfigurationId,
        priceVersionId: c.priceVersionId,
        pricingUnit: c.pricingUnit,
        quantity: c.quantity,
        currency: c.currency,
        unitPrice: c.unitPrice,
        taxPercent: c.taxPercent,
        lineBasisAmount: c.unitPrice * c.quantity,
        commercialReason: c.commercialReason,
        changeReason: params.changeReason.trim(),
        actorId: params.actorId,
        changeCommandContext: params.allowPostConfirmCorrection
          ? 'correction.post_confirm'
          : 'revision.pre_confirm',
      },
    });
    await client.appointment.update({
      where: { id: params.appointmentId },
      data: {
        clinicalServiceId: c.clinicalServiceId,
        effectiveSnapshotRevisionId: revision.id,
      },
    });
    return revision;
  }
}
