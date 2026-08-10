import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  evaluateCompatibilitySelection,
  type CatalogLifecycle,
} from '../../platform-healthcare-catalog/domain/compatibility.evaluator';
import {
  ADDON_SELECTION_MAX,
  EMAIL_MAX,
  EMAIL_REGEX,
  ORG_NAME_MAX,
  PROHIBITED_REQUEST_KEYS,
  SLUG_MAX,
  SLUG_REGEX,
  SPECIALTY_MAX,
  TEXT_FIELD_MAX,
} from '../tenant-provisioning.constants';
import type {
  ProvisioningValidationResult,
  TenantProvisioningRequestInput,
} from '../domain/tenant-provisioning.types';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function fingerprint(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function normalizeSlug(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

@Injectable()
export class TenantProvisioningValidationService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeSlug = normalizeSlug;

  assertNoProhibitedFields(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const walk = (obj: Record<string, unknown>, path: string) => {
      for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();
        if (PROHIBITED_REQUEST_KEYS.some((p) => lower === p.toLowerCase() || lower.includes(p))) {
          throw Object.assign(new Error(`prohibited_field:${path}${key}`), {
            code: 'prohibited_field',
            field: `${path}${key}`,
          });
        }
        const v = obj[key];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          walk(v as Record<string, unknown>, `${path}${key}.`);
        }
      }
    };
    walk(raw as Record<string, unknown>, '');
  }

  async validate(
    body: TenantProvisioningRequestInput,
    opts?: {
      salesTrialOnly?: boolean;
      excludeRequestId?: string;
      /** Own tenant already created by this workflow — do not treat as slug conflict. */
      excludeTenantId?: string;
    },
  ): Promise<ProvisioningValidationResult> {
    const errors: ProvisioningValidationResult['errors'] = [];
    const warnings: ProvisioningValidationResult['warnings'] = [];

    const name = body.organization?.legalOrDisplayName?.trim() ?? '';
    if (!name || name.length > ORG_NAME_MAX) {
      errors.push({ code: 'invalid_organization_name', field: 'organization.legalOrDisplayName' });
    }
    if ((body.organization?.timezone ?? 'UTC').length > 50) {
      errors.push({ code: 'invalid_timezone', field: 'organization.timezone' });
    }

    const slug = normalizeSlug(body.organization?.requestedSlug);
    if (body.organization?.requestedSlug && (!slug || !SLUG_REGEX.test(slug))) {
      errors.push({ code: 'invalid_slug', field: 'organization.requestedSlug' });
    }

    const email = body.tenantAdmin?.email?.toLowerCase()?.trim() ?? '';
    if (!email || email.length > EMAIL_MAX || !EMAIL_REGEX.test(email)) {
      errors.push({ code: 'invalid_admin_email', field: 'tenantAdmin.email' });
    }

    if (!['STANDARD', 'TRIAL_REQUEST'].includes(body.onboardingType)) {
      errors.push({ code: 'invalid_onboarding_type', field: 'onboardingType' });
    }
    if (opts?.salesTrialOnly && body.onboardingType !== 'TRIAL_REQUEST') {
      errors.push({ code: 'sales_standard_forbidden', field: 'onboardingType' });
    }

    const specialtyKeys = [...(body.specialtyKeys ?? [])];
    if (specialtyKeys.length > SPECIALTY_MAX) {
      errors.push({ code: 'specialty_count_exceeded', field: 'specialtyKeys' });
    }
    if (new Set(specialtyKeys).size !== specialtyKeys.length) {
      errors.push({ code: 'duplicate_specialty', field: 'specialtyKeys' });
    }

    const addOns = body.addOnSelections ?? [];
    if (addOns.length > ADDON_SELECTION_MAX) {
      errors.push({ code: 'addon_selection_exceeded', field: 'addOnSelections' });
    }
    const addOnIds = addOns.map((a) => a.addOnId);
    if (new Set(addOnIds).size !== addOnIds.length) {
      errors.push({ code: 'duplicate_addon', field: 'addOnSelections' });
    }
    for (const a of addOns) {
      if (a.quantity && a.quantity.length > TEXT_FIELD_MAX) {
        errors.push({ code: 'invalid_addon_quantity', field: 'addOnSelections' });
      }
      if (a.effectiveFrom && Number.isNaN(Date.parse(a.effectiveFrom))) {
        errors.push({ code: 'invalid_addon_date', field: 'addOnSelections.effectiveFrom' });
      }
      if (a.effectiveUntil && Number.isNaN(Date.parse(a.effectiveUntil))) {
        errors.push({ code: 'invalid_addon_date', field: 'addOnSelections.effectiveUntil' });
      }
    }

    if (!body.facilityTypeKey?.trim()) {
      errors.push({ code: 'missing_facility_type', field: 'facilityTypeKey' });
    }
    if (!body.publishedPlanVersionId?.trim()) {
      errors.push({ code: 'missing_plan_version', field: 'publishedPlanVersionId' });
    }

    if (errors.length) {
      return { valid: false, errors, warnings };
    }

    return this.prisma.withPlatformBypass(async (client) => {
      if (slug) {
        const slugConflict = await client.tenant.findFirst({
          where: {
            slug,
            deletedAt: null,
            ...(opts?.excludeTenantId ? { id: { not: opts.excludeTenantId } } : {}),
          },
          select: { id: true },
        });
        if (slugConflict) {
          errors.push({ code: 'slug_conflict', field: 'organization.requestedSlug' });
        }
        const reserved = await client.platformTenantProvisioningRequest.findFirst({
          where: {
            reservedSlug: slug,
            status: {
              in: ['REQUESTED', 'VALIDATING', 'READY', 'PROVISIONING', 'AWAITING_ACTIVATION'],
            },
            ...(opts?.excludeRequestId ? { id: { not: opts.excludeRequestId } } : {}),
          },
          select: { id: true },
        });
        if (reserved) {
          errors.push({ code: 'slug_reserved', field: 'organization.requestedSlug' });
        }
      }

      const planVersion = await client.platformPlanVersion.findUnique({
        where: { id: body.publishedPlanVersionId },
        include: {
          plan: true,
          entitlements: { include: { catalogItem: true } },
          limits: { include: { catalogItem: true } },
        },
      });
      if (!planVersion) {
        errors.push({
          code: 'unknown_plan_version',
          field: 'publishedPlanVersionId',
        });
      } else if (planVersion.lifecycle !== 'PUBLISHED') {
        errors.push({
          code:
            planVersion.lifecycle === 'RETIRED'
              ? 'plan_version_unassignable'
              : 'plan_version_unpublished',
          field: 'publishedPlanVersionId',
        });
      } else if (opts?.salesTrialOnly) {
        const planKey = planVersion.plan.canonicalKey;
        if (planKey === 'plan.enterprise') {
          errors.push({
            code: 'sales_enterprise_forbidden',
            field: 'publishedPlanVersionId',
            catalogKey: planKey,
          });
        }
      }

      const [items, rules] = await Promise.all([
        client.healthcareCatalogItem.findMany({
          select: { canonicalKey: true, kind: true, lifecycle: true },
        }),
        client.healthcareCatalogCompatibilityRule.findMany({
          include: { subject: true, target: true },
        }),
      ]);

      const facility = items.find((i) => i.canonicalKey === body.facilityTypeKey);
      if (!facility || facility.kind !== 'FACILITY_TYPE') {
        errors.push({
          code: 'unknown_facility_type',
          field: 'facilityTypeKey',
          catalogKey: body.facilityTypeKey,
        });
      } else if (facility.lifecycle !== 'ACTIVE') {
        errors.push({
          code: 'inactive_facility_type',
          field: 'facilityTypeKey',
          catalogKey: body.facilityTypeKey,
        });
      }

      for (const sk of specialtyKeys) {
        const sp = items.find((i) => i.canonicalKey === sk);
        if (!sp || sp.kind !== 'SPECIALTY') {
          errors.push({ code: 'unknown_specialty', field: 'specialtyKeys', catalogKey: sk });
        } else if (sp.lifecycle !== 'ACTIVE') {
          errors.push({ code: 'inactive_specialty', field: 'specialtyKeys', catalogKey: sk });
        }
      }

      const derivedModuleKeys: string[] = [];
      if (planVersion?.lifecycle === 'PUBLISHED') {
        for (const e of planVersion.entitlements) {
          const key = e.catalogItem.canonicalKey;
          if (key.startsWith('module.')) {
            derivedModuleKeys.push(key);
          }
        }
      }

      for (const addOnId of addOnIds) {
        const addOn = await client.platformAddOn.findUnique({
          where: { id: addOnId },
          include: { versions: { where: { lifecycle: 'PUBLISHED' }, take: 1 } },
        });
        if (!addOn) {
          errors.push({ code: 'unknown_addon', field: 'addOnSelections', catalogKey: addOnId });
        } else if (addOn.lifecycle !== 'ACTIVE') {
          errors.push({ code: 'inactive_addon', field: 'addOnSelections', catalogKey: addOnId });
        } else if (!addOn.versions.length) {
          errors.push({
            code: 'addon_no_published_version',
            field: 'addOnSelections',
            catalogKey: addOnId,
          });
        }
      }

      const compat = evaluateCompatibilitySelection(
        {
          facilityTypeKey: body.facilityTypeKey,
          specialtyKeys,
          moduleKeys: derivedModuleKeys,
        },
        items.map((i) => ({
          canonicalKey: i.canonicalKey,
          kind: i.kind,
          lifecycle: i.lifecycle as CatalogLifecycle,
        })),
        rules.map((r) => ({
          id: r.id,
          ruleType: r.ruleType as never,
          subjectKey: r.subject.canonicalKey,
          targetKey: r.target.canonicalKey,
          anyOfGroupKey: r.anyOfGroupKey,
          lifecycle: r.lifecycle as CatalogLifecycle,
        })),
      );

      for (const v of compat.violations) {
        errors.push({
          code: v.reasonCode,
          catalogKey: v.subjectKey ?? v.targetKey,
        });
      }
      for (const w of compat.warnings) {
        warnings.push({
          code: w.reasonCode,
          catalogKey: w.subjectKey ?? w.targetKey,
        });
      }

      // Specialty count Limit — missing ≠ Unlimited
      if (planVersion) {
        const specialtyLimit = planVersion.limits.find(
          (l) =>
            l.catalogItem.canonicalKey === 'limit.max_specialties' ||
            l.catalogItem.canonicalKey === 'limit.specialty_count' ||
            l.catalogItem.canonicalKey.endsWith('.specialties'),
        );
        if (specialtyLimit) {
          if (!specialtyLimit.unlimited && specialtyLimit.valueText != null) {
            const max = Number(specialtyLimit.valueText);
            if (Number.isFinite(max) && specialtyKeys.length > max) {
              errors.push({
                code: 'specialty_count_over_limit',
                field: 'specialtyKeys',
                catalogKey: specialtyLimit.catalogItem.canonicalKey,
              });
            }
          } else if (!specialtyLimit.unlimited && specialtyLimit.valueText == null) {
            warnings.push({
              code: 'specialty_limit_unconfigured',
              field: 'specialtyKeys',
            });
          }
          // unlimited=true → no count reject; missing limit row → do not treat as Unlimited
        }
      }

      const compatibilityFingerprint = fingerprint({
        facilityTypeKey: body.facilityTypeKey,
        specialtyKeys: [...specialtyKeys].sort(),
        moduleKeys: [...derivedModuleKeys].sort(),
        ruleIds: [...compat.applicableRuleIds].sort(),
      });

      const previewFingerprint = fingerprint({
        planVersionId: body.publishedPlanVersionId,
        publicationFingerprint: planVersion?.publicationFingerprint ?? null,
        planKey: planVersion?.plan.canonicalKey ?? null,
        facilityTypeKey: body.facilityTypeKey,
        specialtyKeys: [...specialtyKeys].sort(),
        addOnIds: [...addOnIds].sort(),
        derivedModuleKeys: [...derivedModuleKeys].sort(),
        compatibilityFingerprint,
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        previewFingerprint: errors.length === 0 ? previewFingerprint : undefined,
        compatibilityFingerprint: errors.length === 0 ? compatibilityFingerprint : undefined,
        derivedModuleKeys,
        planKey: planVersion?.plan.canonicalKey,
        planVersionId: planVersion?.id,
      };
    });
  }
}
