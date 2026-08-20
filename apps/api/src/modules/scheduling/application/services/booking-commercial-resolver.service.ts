import { Injectable } from '@nestjs/common';
import { ClinicalPricingUnit, ClinicalPriceVersionStatus } from '@prisma/client';
import {
  ClinicalPriceVersionService,
  CommercialKeyDims,
} from '../../../clinical-catalog/application/clinical-price-version.service';
import { TenantServiceConfigService } from '../../../clinical-catalog/application/tenant-service-config.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  AppointmentSnapshotService,
  ResolvedCanonicalCommercial,
} from './appointment-snapshot.service';
import {
  assertPricingUnitAppliesToDomain,
  assertCoursePackageBookingContext,
  COURSE_PACKAGE_PRICING_UNITS,
} from '../../../clinical-catalog/domain/pricing-unit-applicability';
import { ClinicalCatalogValidationError } from '../../../clinical-catalog/domain/clinical-catalog.errors';

@Injectable()
export class BookingCommercialResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: ClinicalPriceVersionService,
    private readonly configs: TenantServiceConfigService,
    private readonly snapshots: AppointmentSnapshotService,
  ) {}

  async resolveCanonical(params: {
    tenantId: string;
    actorId: string;
    actorRoles?: string[];
    clinicalServiceId: string;
    branchId: string | null;
    pricingUnit: ClinicalPricingUnit;
    currency: string;
    quantity?: number;
    commercialReason?: string | null;
    /** E1/R2 — required when pricingUnit is PER_COURSE or PER_PACKAGE */
    treatmentCourseId?: string | null;
    /** R2-B1 — required for course/package patient binding */
    patientId?: string | null;
  }): Promise<ResolvedCanonicalCommercial> {
    const actor = {
      actorId: params.actorId,
      actorRoles: params.actorRoles ?? ['owner'],
      tenantId: params.tenantId,
    };
    const service = await this.prisma.withPlatformBypass((c) =>
      c.canonicalClinicalServiceDefinition.findFirst({
        where: { id: params.clinicalServiceId },
        include: { translations: true },
      }),
    );
    if (service) {
      assertPricingUnitAppliesToDomain(params.pricingUnit, service.domain);
    }

    // Before any lookupActivePrice / reconcile / mutating commercial work
    assertCoursePackageBookingContext({
      pricingUnit: params.pricingUnit,
      treatmentCourseId: params.treatmentCourseId,
    });

    const cfgResult = await this.configs.getEffectiveConfig(
      actor as never,
      params.clinicalServiceId,
      params.branchId,
    );

    const en =
      service?.translations.find((t) => t.locale.startsWith('en'))?.displayName ??
      service?.stableKey ??
      params.clinicalServiceId;
    const ar =
      service?.translations.find((t) => t.locale.startsWith('ar'))?.displayName ?? en;

    // Course/package: exact packagePriceVersionId + PA-04 lock/reconcile/interval (R3-B1)
    // Does NOT call lookupActivePrice (avoids double reconciliation / generic substitution).
    if (COURSE_PACKAGE_PRICING_UNITS.has(params.pricingUnit)) {
      const courseBound = await this.resolveExactCoursePackagePrice({
        tenantId: params.tenantId,
        actor,
        treatmentCourseId: params.treatmentCourseId!.trim(),
        clinicalServiceId: params.clinicalServiceId,
        pricingUnit: params.pricingUnit,
        branchId: params.branchId,
        patientId: params.patientId ?? null,
        currency: params.currency,
      });
      this.snapshots.assertZeroAllowed(courseBound.unitPrice, params.commercialReason);
      return {
        clinicalServiceId: params.clinicalServiceId,
        stableKey: service?.stableKey ?? params.clinicalServiceId,
        displayNameAr: ar,
        displayNameEn: en,
        tenantServiceConfigurationId: cfgResult.config.id,
        priceVersionId: courseBound.priceVersionId,
        pricingUnit: params.pricingUnit,
        currency: params.currency,
        unitPrice: courseBound.unitPrice,
        taxPercent: courseBound.taxPercent,
        quantity: params.quantity ?? 1,
        commercialReason: params.commercialReason ?? null,
      };
    }

    const priceLookup = await this.prices.lookupActivePrice(
      actor as never,
      params.clinicalServiceId,
      params.branchId,
      {
        pricingUnit: params.pricingUnit,
        currency: params.currency,
      },
    );
    const price = priceLookup.price;
    const unitPrice = Number(price.unitPrice);
    const taxPercent = Number(price.taxPercent ?? 0);
    this.snapshots.assertZeroAllowed(unitPrice, params.commercialReason);

    return {
      clinicalServiceId: params.clinicalServiceId,
      stableKey: service?.stableKey ?? params.clinicalServiceId,
      displayNameAr: ar,
      displayNameEn: en,
      tenantServiceConfigurationId: cfgResult.config.id,
      priceVersionId: price.id,
      pricingUnit: params.pricingUnit,
      currency: params.currency,
      unitPrice,
      taxPercent,
      quantity: params.quantity ?? 1,
      commercialReason: params.commercialReason ?? null,
    };
  }

  /**
   * Exact TreatmentCourse.packagePriceVersionId binding + PA-04 live authority.
   * Uses resolveCurrentKeyOutcome (lock → reconcile → interval-valid ACTIVE) once.
   * Final priceVersionId MUST equal course.packagePriceVersionId (no generic substitute).
   */
  private async resolveExactCoursePackagePrice(params: {
    tenantId: string;
    actor: { actorId: string; actorRoles: string[]; tenantId: string };
    treatmentCourseId: string;
    clinicalServiceId: string;
    pricingUnit: ClinicalPricingUnit;
    branchId: string | null;
    patientId: string | null;
    currency: string;
  }): Promise<{ priceVersionId: string; unitPrice: number; taxPercent: number }> {
    if (!params.patientId?.trim()) {
      throw new ClinicalCatalogValidationError(
        'patientId is required for TreatmentCourse-aware PER_COURSE/PER_PACKAGE booking',
      );
    }
    const course = await this.prisma.withPlatformBypass((c) =>
      c.treatmentCourse.findFirst({
        where: {
          id: params.treatmentCourseId,
          tenantId: params.tenantId,
          deletedAt: null,
        },
      }),
    );
    if (!course) {
      throw new ClinicalCatalogValidationError('treatmentCourseId not found for tenant');
    }
    if (course.patientId !== params.patientId) {
      throw new ClinicalCatalogValidationError(
        'treatmentCourseId patientId does not match booking patientId',
      );
    }
    if (course.clinicalServiceId !== params.clinicalServiceId) {
      throw new ClinicalCatalogValidationError(
        'treatmentCourseId clinicalServiceId does not match booking clinicalServiceId',
      );
    }
    if (course.status === 'CANCELLED' || course.status === 'COMPLETED') {
      throw new ClinicalCatalogValidationError(
        `TreatmentCourse status ${course.status} cannot authorize course/package pricing`,
      );
    }
    if (!course.packagePriceVersionId) {
      throw new ClinicalCatalogValidationError(
        'TreatmentCourse requires packagePriceVersionId for PER_COURSE/PER_PACKAGE booking',
      );
    }

    const packagePriceVersionId = course.packagePriceVersionId;

    // Pre-lock identity / branch fail-closed (still re-validated after PA-04 outcome)
    const preLockPv = await this.prisma.withPlatformBypass((c) =>
      c.clinicalServicePriceVersion.findFirst({
        where: { id: packagePriceVersionId, tenantId: params.tenantId },
      }),
    );
    if (!preLockPv) {
      throw new ClinicalCatalogValidationError('packagePriceVersionId not found for tenant');
    }
    if (preLockPv.clinicalServiceId !== params.clinicalServiceId) {
      throw new ClinicalCatalogValidationError('packagePriceVersionId clinical service mismatch');
    }
    if (preLockPv.pricingUnit !== params.pricingUnit) {
      throw new ClinicalCatalogValidationError(
        `pricingUnit ${params.pricingUnit} does not match course packagePriceVersion unit ${preLockPv.pricingUnit}`,
      );
    }
    if (preLockPv.currency !== params.currency) {
      throw new ClinicalCatalogValidationError(
        `currency ${params.currency} does not match course packagePriceVersion currency ${preLockPv.currency}`,
      );
    }

    // Branch-specific package: booking branch MUST be present and equal (R3-B1)
    if (preLockPv.branchId != null) {
      if (params.branchId == null) {
        throw new ClinicalCatalogValidationError(
          'branch-specific packagePriceVersionId requires booking branchId',
        );
      }
      if (params.branchId !== preLockPv.branchId) {
        throw new ClinicalCatalogValidationError(
          'packagePriceVersionId branch does not match booking branch',
        );
      }
    }

    // Commercial key = package price's own scope (branch or global/tenant)
    const key: CommercialKeyDims = {
      tenantId: params.tenantId,
      branchId: preLockPv.branchId,
      clinicalServiceId: params.clinicalServiceId,
      pricingUnit: params.pricingUnit,
      currency: params.currency,
      serviceVariantId: preLockPv.serviceVariantId ?? null,
    };

    const now = new Date();
    // PA-04: advisory lock → reconcile → interval-valid ACTIVE (single authoritative path)
    const outcome = await this.prices.resolveCurrentKeyOutcome(
      params.actor as never,
      key,
      now,
    );

    if (outcome.kind !== 'CURRENT_ACTIVE') {
      throw new ClinicalCatalogValidationError(
        'TreatmentCourse packagePriceVersionId is not a current PA-04-valid commercial price',
      );
    }

    const current = outcome.price;
    // Exact binding — after reconciliation, package id must still be the current valid price
    if (current.id !== packagePriceVersionId) {
      throw new ClinicalCatalogValidationError(
        'TreatmentCourse.packagePriceVersionId is not the current valid package price after PA-04 reconciliation',
      );
    }
    if (current.status !== ClinicalPriceVersionStatus.ACTIVE) {
      throw new ClinicalCatalogValidationError(
        `packagePriceVersionId must be ACTIVE after PA-04 (was ${current.status})`,
      );
    }

    return {
      priceVersionId: packagePriceVersionId,
      unitPrice: Number(current.unitPrice),
      taxPercent: Number(current.taxPercent ?? 0),
    };
  }
}
