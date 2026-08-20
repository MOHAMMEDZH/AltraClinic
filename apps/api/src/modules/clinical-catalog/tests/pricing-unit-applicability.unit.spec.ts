import { ClinicalPricingUnit } from '@prisma/client';
import { ClinicalCatalogValidationError } from '../domain/clinical-catalog.errors';
import { assertPricingUnitAppliesToDomain } from '../domain/pricing-unit-applicability';

describe('Wave D P1-02 pricing-unit applicability', () => {
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

  it('rejects PER_COURSE without course SoR', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_COURSE, 'DENTAL'),
    ).toThrow(/without a treatment course/);
  });

  it('allows PER_VISIT on GENERAL', () => {
    expect(() =>
      assertPricingUnitAppliesToDomain(ClinicalPricingUnit.PER_VISIT, 'GENERAL'),
    ).not.toThrow();
  });
});
