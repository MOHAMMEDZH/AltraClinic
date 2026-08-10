/**
 * Release 47 Step 10 — Resolver lookup table.
 * Maps a registry `resolverKey` to its aggregate resolver implementation.
 */
import type { MetricResolverKey } from '../metric-registry';
import type { MetricResolver } from './resolver.types';
import {
  resolveTenantByStatus,
  resolveTenantTotal,
  resolveTenantTrialing,
} from './tenant.resolvers';
import { resolveSubscriptionByStatus } from './subscription.resolvers';
import { resolveLegacyPlanAssignment } from './legacy-plan.resolver';
import { resolveFacilityTypeDistribution } from './facility-type.resolver';

export const METRIC_RESOLVERS: Record<MetricResolverKey, MetricResolver> = {
  'tenant.total': resolveTenantTotal,
  'tenant.byStatus': resolveTenantByStatus,
  'tenant.trialing': resolveTenantTrialing,
  'subscription.byStatus': resolveSubscriptionByStatus,
  'legacyPlan.assignment': resolveLegacyPlanAssignment,
  'facilityType.distribution': resolveFacilityTypeDistribution,
};

export * from './resolver.types';
