import {
  ClinicalCatalogValidationError,
  ClinicalCatalogErrorCode,
} from './clinical-catalog.errors';
import type { ClinicalServiceLifecycle } from '@prisma/client';

const ALLOWED: Record<ClinicalServiceLifecycle, ClinicalServiceLifecycle[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['DEPRECATED', 'INACTIVE'],
  DEPRECATED: ['INACTIVE'],
  INACTIVE: [],
};

export function assertLifecycleTransition(
  from: ClinicalServiceLifecycle,
  to: ClinicalServiceLifecycle,
): void {
  if (!ALLOWED[from]?.includes(to)) {
    throw new ClinicalCatalogValidationError(
      `Invalid lifecycle transition ${from} → ${to}.`,
      ClinicalCatalogErrorCode.LIFECYCLE_INVALID,
    );
  }
}

export function isEditableLifecycle(lifecycle: ClinicalServiceLifecycle): boolean {
  return lifecycle === 'DRAFT';
}
