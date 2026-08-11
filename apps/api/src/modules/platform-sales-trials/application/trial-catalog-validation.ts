import type { PrismaService } from '../../../infrastructure/prisma.service';
import { SalesTrialValidationError } from '../domain/sales-trial.errors';
import {
  MAX_TRIAL_MODULE_KEYS,
  MAX_TRIAL_SPECIALTY_KEYS,
  isSalesTrialsFailureInjectionActive,
} from '../platform-sales-trials.constants';

export function normalizeKeyArray(
  keys: string[] | undefined,
  max: number,
  label: string,
): string[] {
  const list = (keys ?? []).map((k) => (k ?? '').trim()).filter(Boolean);
  if (list.length > max) {
    throw new SalesTrialValidationError(`${label} exceeds max ${max}.`, 'key_list_too_large');
  }
  return [...new Set(list)];
}

/**
 * Flexible Step 25 — selections must resolve to authoritative Catalog canonical keys.
 * The Catalog remains the only key authority: Trials never invent keys and never
 * mutate Catalog rows.
 */
export async function validateTrialCatalogSelection(
  prisma: PrismaService,
  input: { facilityTypeKey: string; specialtyKeys?: string[]; moduleKeys?: string[] },
): Promise<{ facilityTypeKey: string; specialtyKeys: string[]; moduleKeys: string[] }> {
  const facilityTypeKey = (input.facilityTypeKey ?? '').trim();
  if (!facilityTypeKey) {
    throw new SalesTrialValidationError('facilityTypeKey is required.', 'facility_type_required');
  }
  const specialtyKeys = normalizeKeyArray(
    input.specialtyKeys,
    MAX_TRIAL_SPECIALTY_KEYS,
    'selectedSpecialtyKeys',
  );
  const moduleKeys = normalizeKeyArray(input.moduleKeys, MAX_TRIAL_MODULE_KEYS, 'selectedModuleKeys');

  const allKeys = [facilityTypeKey, ...specialtyKeys, ...moduleKeys];
  const rows = await prisma.healthcareCatalogItem.findMany({
    where: { canonicalKey: { in: allKeys } },
    select: { canonicalKey: true, kind: true, lifecycle: true },
  });
  const byKey = new Map(rows.map((r) => [r.canonicalKey, r]));

  const facility = byKey.get(facilityTypeKey);
  if (!facility) {
    throw new SalesTrialValidationError(
      `facilityTypeKey ${facilityTypeKey} is not an authoritative Catalog key.`,
      'facility_type_unknown',
    );
  }
  if (facility.kind !== 'FACILITY_TYPE') {
    throw new SalesTrialValidationError(
      `facilityTypeKey ${facilityTypeKey} is not a FACILITY_TYPE Catalog item.`,
      'facility_type_kind_mismatch',
    );
  }
  assertUsableLifecycle(facilityTypeKey, facility.lifecycle);

  for (const key of specialtyKeys) {
    const row = byKey.get(key);
    if (!row) {
      throw new SalesTrialValidationError(
        `specialty key ${key} is not an authoritative Catalog key.`,
        'specialty_unknown',
      );
    }
    if (row.kind !== 'SPECIALTY') {
      throw new SalesTrialValidationError(
        `specialty key ${key} is not a SPECIALTY Catalog item.`,
        'specialty_kind_mismatch',
      );
    }
    assertUsableLifecycle(key, row.lifecycle);
  }

  for (const key of moduleKeys) {
    const row = byKey.get(key);
    if (!row) {
      throw new SalesTrialValidationError(
        `module key ${key} is not an authoritative Catalog key.`,
        'module_unknown',
      );
    }
    if (row.kind !== 'MODULE') {
      throw new SalesTrialValidationError(
        `module key ${key} is not a MODULE Catalog item.`,
        'module_kind_mismatch',
      );
    }
    assertUsableLifecycle(key, row.lifecycle);
  }

  if (isSalesTrialsFailureInjectionActive('after_catalog_validation')) {
    throw new SalesTrialValidationError('Injected after catalog validation', 'injected_failure');
  }
  return { facilityTypeKey, specialtyKeys, moduleKeys };
}

function assertUsableLifecycle(key: string, lifecycle: string): void {
  if (lifecycle === 'RETIRED') {
    throw new SalesTrialValidationError(
      `Catalog key ${key} is RETIRED and cannot be selected.`,
      'catalog_key_retired',
    );
  }
}

export type TrialPlanVersionResolution = {
  id: string;
  planCanonicalKey: string;
  versionNumber: number;
  trialDefaultEnabled: boolean | null;
  trialDefaultDays: number | null;
  isPaid: boolean;
};

/**
 * Trial activation and conversion both require an immutable PUBLISHED Plan Version with a
 * publication fingerprint. Draft/Retired/`plan.business` are denied; there is never an
 * implicit "latest published" substitution.
 */
export async function resolvePublishedPlanVersion(
  prisma: PrismaService,
  planVersionId: string,
  purpose: 'trial' | 'conversion',
): Promise<TrialPlanVersionResolution> {
  if (!planVersionId?.trim()) {
    throw new SalesTrialValidationError(
      `${purpose === 'trial' ? 'trialPlanVersionId' : 'targetPaidPlanVersionId'} is required.`,
      'plan_version_required',
    );
  }
  const pv = await prisma.platformPlanVersion.findUnique({
    where: { id: planVersionId },
    include: { plan: true },
  });
  if (!pv) {
    throw new SalesTrialValidationError('Plan Version not found.', 'plan_version_missing');
  }
  if (pv.lifecycle === 'RETIRED') {
    throw new SalesTrialValidationError(
      'Retired Plan Versions cannot be selected.',
      'plan_version_retired',
    );
  }
  if (pv.lifecycle !== 'PUBLISHED') {
    throw new SalesTrialValidationError(
      'Plan Version must be PUBLISHED.',
      'plan_version_not_published',
    );
  }
  if (!pv.publicationFingerprint) {
    throw new SalesTrialValidationError(
      'Plan Version publication fingerprint is missing.',
      'plan_fingerprint_missing',
    );
  }
  if (pv.plan.canonicalKey === 'plan.business') {
    throw new SalesTrialValidationError('plan.business is rejected.', 'plan_business_rejected');
  }
  const isPaid = pv.priceAmountMinor != null && pv.priceAmountMinor > 0;
  if (purpose === 'conversion' && !isPaid) {
    throw new SalesTrialValidationError(
      'Conversion target must be a paid Plan Version (priced commercial definition).',
      'plan_version_not_paid',
    );
  }
  if (isSalesTrialsFailureInjectionActive('after_plan_version_validation')) {
    throw new SalesTrialValidationError('Injected after plan version validation', 'injected_failure');
  }
  return {
    id: pv.id,
    planCanonicalKey: pv.plan.canonicalKey,
    versionNumber: pv.versionNumber,
    trialDefaultEnabled: pv.trialDefaultEnabled,
    trialDefaultDays: pv.trialDefaultDays,
    isPaid,
  };
}
