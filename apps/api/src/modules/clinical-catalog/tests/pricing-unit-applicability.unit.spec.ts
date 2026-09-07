import { ClinicalPricingUnit } from '@prisma/client';
import { ClinicalCatalogValidationError } from '../domain/clinical-catalog.errors';
import {
  assertCoursePackageBookingContext,
  assertPricingUnitAppliesToDomain,
} from '../domain/pricing-unit-applicability';

describe('Wave E pricing-unit applicability (TreatmentCourse SoR active)', () => {
  it('allows PER_TOOTH on DENTAL', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_TOOTH, 'DENTAL'),
    ).not.toThrow();
  });

  it('rejects PER_TOOTH on AESTHETIC', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_TOOTH, 'AESTHETIC'),
    ).toThrow(ClinicalCatalogValidationError);
  });

  it('rejects PER_AREA on DENTAL', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_AREA, 'DENTAL'),
    ).toThrow(ClinicalCatalogValidationError);
  });

  it('allows PER_COURSE once TreatmentCourse SoR is present', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_COURSE, 'AESTHETIC'),
    ).not.toThrow();
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_PACKAGE, 'GENERAL'),
    ).not.toThrow();
  });

  it('allows PER_VISIT on GENERAL', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_VISIT, 'GENERAL'),
    ).not.toThrow();
  });

  describe('assertCoursePackageBookingContext (E1 fail-closed)', () => {
    it('rejects standalone PER_COURSE without treatmentCourseId', () => {
      expect(() =>
        assertCoursePackageBookingContext({
          pricingUnit: ClinicalPricingUnit.PER_COURSE,
        }),
      ).toThrow(ClinicalCatalogValidationError);
    });

    it('rejects standalone PER_PACKAGE without treatmentCourseId', () => {
      expect(() =>
        assertCoursePackageBookingContext({
          pricingUnit: ClinicalPricingUnit.PER_PACKAGE,
        }),
      ).toThrow(ClinicalCatalogValidationError);
    });

    it('allows PER_COURSE when treatmentCourseId is present', () => {
      expect(() =>
        assertCoursePackageBookingContext({
          pricingUnit: ClinicalPricingUnit.PER_COURSE,
          treatmentCourseId: '00000000-0000-4000-8000-000000000001',
        }),
      ).not.toThrow();
    });

    it('allows PER_PACKAGE when treatmentCourseId is present', () => {
      expect(() =>
        assertCoursePackageBookingContext({
          pricingUnit: ClinicalPricingUnit.PER_PACKAGE,
          treatmentCourseId: '00000000-0000-4000-8000-000000000002',
        }),
      ).not.toThrow();
    });

    it('does not affect PER_VISIT standalone booking', () => {
      expect(() =>
        assertCoursePackageBookingContext({
          pricingUnit: ClinicalPricingUnit.PER_VISIT,
        }),
      ).not.toThrow();
    });
  });
});
