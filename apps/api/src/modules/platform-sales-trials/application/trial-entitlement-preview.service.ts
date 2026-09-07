import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import type { EffectiveLimit } from '../../effective-entitlement-runtime/domain/effective-entitlement.types';
import { resolvePublishedPlanVersion } from './trial-catalog-validation';
import { TrialAdminService } from './trial-admin.service';
import { SALES_TRIAL_PERMISSIONS, isSalesTrialsFailureInjectionActive } from '../platform-sales-trials.constants';
import { SalesTrialForbiddenError, SalesTrialValidationError } from '../domain/sales-trial.errors';
import type {
  TrialEntitlementPreviewDto,
  TrialLimitComparison,
  TrialLimitState,
  TrialOnlyGrant,
} from '../domain/sales-trial.types';

type LimitFacts = { state: TrialLimitState; value: string | null };

function eerLimitToFacts(limit: EffectiveLimit | undefined): LimitFacts {
  if (!limit) return { state: 'UNCONFIGURED', value: null };
  if (limit.state === 'UNLIMITED') return { state: 'UNLIMITED', value: null };
  if (limit.state === 'CONFIGURED') return { state: 'CONFIGURED', value: limit.value };
  return { state: 'UNCONFIGURED', value: null };
}

/**
 * Flexible Step 25 — read-only Trial → paid entitlement comparison.
 *
 * Strictly read-only: this service issues no writes at all, so every protected SoR delta
 * (Trial, Subscription, Plan, PlanVersion, Entitlement, Limit, Add-on, Override,
 * Provisioning, Lifecycle, EER active snapshot) is 0. The comparison is advisory
 * evidence for the operator, never an entitlement or runtime license decision.
 */
@Injectable()
export class TrialEntitlementPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: TrialAdminService,
    @Optional() private readonly eer?: EffectiveEntitlementRuntimeService,
  ) {}

  async preview(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    trialId: string,
    targetPaidPlanVersionId: string,
  ): Promise<TrialEntitlementPreviewDto> {
    if (!perms.has(SALES_TRIAL_PERMISSIONS.previewEntitlements)) {
      throw new SalesTrialForbiddenError(`Missing ${SALES_TRIAL_PERMISSIONS.previewEntitlements}`);
    }
    if (isSalesTrialsFailureInjectionActive('comparison_preview_dependency')) {
      throw new SalesTrialValidationError(
        'Injected comparison preview dependency failure',
        'injected_failure',
      );
    }
    const trial = await this.admin.getById(claims, perms, trialId);
    const target = await resolvePublishedPlanVersion(
      this.prisma,
      targetPaidPlanVersionId,
      'conversion',
    );

    const incompatibilities: TrialEntitlementPreviewDto['incompatibilities'] = [];

    const trialFacts = await this.resolveTrialFacts(trial.platformTenantId, trial.trialPlanVersionId);
    if (trialFacts.source === 'PLAN_DEFINITION') {
      incompatibilities.push({
        reasonCode: 'trial_runtime_snapshot_unavailable',
        message:
          'No runtime EER snapshot resolved for the Trial tenant; comparison uses the Trial Plan Version definition.',
      });
    }
    const paidFacts = await this.planVersionFacts(target.id);

    const trialKeys = new Set([
      ...trialFacts.modules,
      ...trialFacts.features,
      ...trialFacts.specialties,
    ]);
    const paidKeys = new Set([...paidFacts.modules, ...paidFacts.features, ...paidFacts.specialties]);

    const retainedEntitlements = [...trialKeys].filter((k) => paidKeys.has(k)).sort();
    const removedEntitlements = [...trialKeys].filter((k) => !paidKeys.has(k)).sort();
    const addedEntitlements = [...paidKeys].filter((k) => !trialKeys.has(k)).sort();

    for (const key of trial.selectedModuleKeys) {
      if (!paidFacts.modules.includes(key)) {
        incompatibilities.push({
          reasonCode: 'selected_module_not_in_paid_plan',
          message: `Selected module ${key} is not granted by the target paid Plan Version.`,
          subjectKey: key,
        });
      }
    }
    for (const key of trial.selectedSpecialtyKeys) {
      if (!paidFacts.specialties.includes(key)) {
        incompatibilities.push({
          reasonCode: 'selected_specialty_not_in_paid_plan',
          message: `Selected specialty ${key} is not granted by the target paid Plan Version.`,
          subjectKey: key,
        });
      }
    }

    const limitKeys = [
      ...new Set([...Object.keys(trialFacts.limits), ...Object.keys(paidFacts.limits)]),
    ].sort();
    const limits: TrialLimitComparison[] = [];
    const unconfiguredVsUnlimited: TrialEntitlementPreviewDto['unconfiguredVsUnlimited'] = [];
    for (const canonicalKey of limitKeys) {
      const t = trialFacts.limits[canonicalKey] ?? { state: 'UNCONFIGURED', value: null };
      const p = paidFacts.limits[canonicalKey] ?? { state: 'UNCONFIGURED', value: null };
      limits.push({
        canonicalKey,
        trialState: t.state,
        trialValue: t.value,
        paidState: p.state,
        paidValue: p.value,
        classification: classifyLimit(t, p),
      });
      // Missing is never Unlimited: surface the distinction explicitly.
      const involvesUnconfigured = t.state === 'UNCONFIGURED' || p.state === 'UNCONFIGURED';
      const involvesUnlimited = t.state === 'UNLIMITED' || p.state === 'UNLIMITED';
      if (involvesUnconfigured && (involvesUnlimited || t.state !== p.state)) {
        unconfiguredVsUnlimited.push({
          canonicalKey,
          trialState: t.state,
          paidState: p.state,
        });
      }
    }

    const grants: TrialOnlyGrant[] = trial.trialOnlyGrants ?? [];
    const trialOnlyGrantKeys = grants.filter((g) => g.trialOnly).map((g) => g.grantKey);
    const trialOnlyMigrating = trialOnlyGrantKeys.filter((k) => paidKeys.has(k)).sort();
    const trialOnlyExpiring = trialOnlyGrantKeys.filter((k) => !paidKeys.has(k)).sort();

    return {
      trialId: trial.id,
      trialPlanVersionId: trial.trialPlanVersionId,
      targetPaidPlanVersionId: target.id,
      retainedEntitlements,
      addedEntitlements,
      removedEntitlements,
      limits,
      trialOnlyExpiring,
      trialOnlyMigrating,
      incompatibilities,
      unconfiguredVsUnlimited,
      requiredDispositionGrantKeys: [...trialOnlyGrantKeys].sort(),
      runtimeSource: 'STEP16_SNAPSHOT_STEP18_EER',
      disclaimer: {
        readOnly: true,
        doesNotMutateProtectedSoR: true,
        notEntitlementDecision: true,
        notRuntimeLicenseDecision: true,
      },
    };
  }

  /**
   * Trial-side facts come from Step 18 EER (which reads the Step 16 activation snapshot).
   * When the tenant has no resolvable runtime snapshot we fall back to the immutable
   * Trial Plan Version definition and flag it as an incompatibility note.
   */
  private async resolveTrialFacts(
    platformTenantId: string | null,
    trialPlanVersionId: string,
  ): Promise<{
    source: 'EER' | 'PLAN_DEFINITION';
    modules: string[];
    features: string[];
    specialties: string[];
    limits: Record<string, LimitFacts>;
  }> {
    if (platformTenantId && this.eer) {
      const pt = await this.prisma.platformTenant.findUnique({
        where: { id: platformTenantId },
        select: { tenantId: true },
      });
      if (pt) {
        const bundle = await this.eer.resolveEffectiveEntitlements(pt.tenantId);
        if (bundle.source === 'SNAPSHOT') {
          const limits: Record<string, LimitFacts> = {};
          for (const [key, limit] of Object.entries(bundle.limits ?? {})) {
            limits[key] = eerLimitToFacts(limit);
          }
          return {
            source: 'EER',
            modules: [...bundle.modules].sort(),
            features: [...bundle.features].sort(),
            specialties: [...bundle.specialties].sort(),
            limits,
          };
        }
      }
    }
    const facts = await this.planVersionFacts(trialPlanVersionId);
    return { source: 'PLAN_DEFINITION', ...facts };
  }

  private async planVersionFacts(planVersionId: string): Promise<{
    modules: string[];
    features: string[];
    specialties: string[];
    limits: Record<string, LimitFacts>;
  }> {
    const [entitlements, limitRows] = await Promise.all([
      this.prisma.platformPlanVersionEntitlement.findMany({
        where: { planVersionId },
        select: { catalogItem: { select: { canonicalKey: true, kind: true } } },
      }),
      this.prisma.platformPlanVersionLimit.findMany({
        where: { planVersionId },
        select: {
          unlimited: true,
          valueText: true,
          catalogItem: { select: { canonicalKey: true } },
        },
      }),
    ]);
    const modules: string[] = [];
    const features: string[] = [];
    const specialties: string[] = [];
    for (const row of entitlements) {
      const key = row.catalogItem.canonicalKey;
      if (row.catalogItem.kind === 'MODULE') modules.push(key);
      else if (row.catalogItem.kind === 'FEATURE') features.push(key);
      else if (row.catalogItem.kind === 'SPECIALTY') specialties.push(key);
    }
    const limits: Record<string, LimitFacts> = {};
    for (const row of limitRows) {
      limits[row.catalogItem.canonicalKey] = row.unlimited
        ? { state: 'UNLIMITED', value: null }
        : row.valueText != null
          ? { state: 'CONFIGURED', value: row.valueText }
          : { state: 'UNCONFIGURED', value: null };
    }
    return {
      modules: modules.sort(),
      features: features.sort(),
      specialties: specialties.sort(),
      limits,
    };
  }
}

function classifyLimit(
  trial: LimitFacts,
  paid: LimitFacts,
): TrialLimitComparison['classification'] {
  const trialPresent = trial.state !== 'UNCONFIGURED';
  const paidPresent = paid.state !== 'UNCONFIGURED';
  if (trialPresent && !paidPresent) return 'REMOVED';
  if (!trialPresent && paidPresent) return 'ADDED';
  if (trial.state === paid.state && trial.value === paid.value) return 'RETAINED';
  return 'CHANGED';
}
