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

const COURSE_UNITS = new Set<ClinicalPricingUnit>([
  ClinicalPricingUnit.PER_COURSE,
  ClinicalPricingUnit.PER_PACKAGE,
]);

/**
 * Wave D P1-02 — frozen matrix at PriceVersion publish and booking.
 * PER_COURSE/PER_PACKAGE require Wave E TreatmentCourse SoR; fail closed until then.
 */
export function assertPricingUnitAppliesToDomain(
  pricingUnit: ClinicalPricingUnit,
  domain: ClinicalServiceDomain | string,
): void {
  const d = String(domain);
  if (COURSE_UNITS.has(pricingUnit)) {
    throw new ClinicalCatalogValidationError(
      `${pricingUnit} is invalid for services without a treatment course (Wave E SoR not present)`,
    );
  }
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
