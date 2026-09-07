import { ClinicalPricingUnit, ClinicalServiceDomain } from '@prisma/client';
import { ClinicalCatalogValidationError } from './clinical-catalog.errors';

const DENTAL_UNITS = new Set<ClinicalPricingUnit>([
  ClinicalPricingUnit.PER_TOOTH,
  ClinicalPricingUnit.PER_SURFACE,
  ClinicalPricingUnit.PER_QUADRANT,
  ClinicalPricingUnit.PER_ARCH,
]);

const AESTHETIC_AREA_UNITS = new Set<ClinicalPricingUnit>([
  ClinicalPricingUnit.PER_AREA,
]);

/** Course/package units require TreatmentCourse SoR context — not standalone booking. */
export const COURSE_PACKAGE_PRICING_UNITS = new Set<ClinicalPricingUnit>([
  ClinicalPricingUnit.PER_COURSE,
  ClinicalPricingUnit.PER_PACKAGE,
]);

/**
 * Domain matrix (Wave A/E).
 * PER_COURSE / PER_PACKAGE are domain-legal once TreatmentCourse SoR exists,
 * but standalone booking must still supply validated course context (see assertCoursePackageBookingContext).
 */
export function assertPricingUnitAppliesToDomain(
  pricingUnit: ClinicalPricingUnit,
  domain: ClinicalServiceDomain | string,
): void {
  const d = String(domain);
  if (DENTAL_UNITS.has(pricingUnit) && d === 'AESTHETIC') {
    throw new ClinicalCatalogValidationError(
      `${pricingUnit} is invalid with aesthetic body-area-only services`,
    );
  }
  if (AESTHETIC_AREA_UNITS.has(pricingUnit) && d === 'DENTAL') {
    throw new ClinicalCatalogValidationError(
      `${pricingUnit} is invalid with tooth-only dental services`,
    );
  }
}

/**
 * E1 — Standalone appointment booking is fail-closed for PER_COURSE / PER_PACKAGE
 * unless an explicit treatmentCourseId context is present.
 * Domain alone must never authorize course/package pricing.
 */
export function assertCoursePackageBookingContext(params: {
  pricingUnit: ClinicalPricingUnit;
  treatmentCourseId?: string | null;
}): void {
  if (!COURSE_PACKAGE_PRICING_UNITS.has(params.pricingUnit)) return;
  if (!params.treatmentCourseId?.trim()) {
    throw new ClinicalCatalogValidationError(
      `${params.pricingUnit} requires an explicit TreatmentCourse context (treatmentCourseId); standalone booking is fail-closed`,
    );
  }
}
