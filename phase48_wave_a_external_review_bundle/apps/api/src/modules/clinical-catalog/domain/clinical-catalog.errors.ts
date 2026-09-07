import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/** Deterministic error codes for Wave A clinical catalog. */
export enum ClinicalCatalogErrorCode {
  NOT_FOUND = 'CLINICAL_CATALOG_NOT_FOUND',
  VALIDATION = 'CLINICAL_CATALOG_VALIDATION',
  FORBIDDEN = 'CLINICAL_CATALOG_FORBIDDEN',
  CONFLICT = 'CLINICAL_CATALOG_CONFLICT',
  STABLE_KEY_IMMUTABLE = 'CLINICAL_CATALOG_STABLE_KEY_IMMUTABLE',
  BILINGUAL_REQUIRED = 'CLINICAL_CATALOG_BILINGUAL_REQUIRED',
  NAMESPACE_INVALID = 'CLINICAL_CATALOG_NAMESPACE_INVALID',
  SYSTEM_CANONICAL_MUTATION_DENIED = 'CLINICAL_CATALOG_SYSTEM_CANONICAL_MUTATION_DENIED',
  TENANT_ISOLATION = 'CLINICAL_CATALOG_TENANT_ISOLATION',
  FEATURE_FLAG_BLOCKED = 'CLINICAL_CATALOG_FEATURE_FLAG_BLOCKED',
  LIFECYCLE_INVALID = 'CLINICAL_CATALOG_LIFECYCLE_INVALID',
  PRICE_NOT_FOUND = 'CLINICAL_PRICE_NOT_FOUND',
  PRICE_OVERLAP = 'CLINICAL_PRICE_OVERLAP',
  PRICE_LOOKUP_FAIL_CLOSED = 'CLINICAL_PRICE_LOOKUP_FAIL_CLOSED',
  APPEND_ONLY_VIOLATION = 'CLINICAL_PRICE_APPEND_ONLY_VIOLATION',
  BRANCH_TENANT_MISMATCH = 'CLINICAL_CATALOG_BRANCH_TENANT_MISMATCH',
}

function payload(code: ClinicalCatalogErrorCode, message: string) {
  return { code, message };
}

export class ClinicalCatalogNotFoundError extends NotFoundException {
  constructor(message = 'Clinical service not found.') {
    super(payload(ClinicalCatalogErrorCode.NOT_FOUND, message));
  }
}

export class ClinicalCatalogValidationError extends UnprocessableEntityException {
  constructor(message: string, code = ClinicalCatalogErrorCode.VALIDATION) {
    super(payload(code, message));
  }
}

export class ClinicalCatalogForbiddenError extends ForbiddenException {
  constructor(message: string, code = ClinicalCatalogErrorCode.FORBIDDEN) {
    super(payload(code, message));
  }
}

export class ClinicalCatalogConflictError extends ConflictException {
  constructor(message: string, code = ClinicalCatalogErrorCode.CONFLICT) {
    super(payload(code, message));
  }
}

export class ClinicalPriceNotFoundError extends NotFoundException {
  constructor(message = 'Clinical price version not found.') {
    super(payload(ClinicalCatalogErrorCode.PRICE_NOT_FOUND, message));
  }
}

export class ClinicalPriceLookupFailClosedError extends NotFoundException {
  constructor(message = 'No active clinical price found for the requested scope.') {
    super(payload(ClinicalCatalogErrorCode.PRICE_LOOKUP_FAIL_CLOSED, message));
  }
}
