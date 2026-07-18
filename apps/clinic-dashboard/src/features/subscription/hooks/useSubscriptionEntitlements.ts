import { useMemo } from 'react';

import { useAiSubscription } from '@/features/ai/hooks/useAiSubscription';

import {

  getPlanLimits,

  isFeatureEnabled,

  resolveSubscriptionPlanId,

  type SubscriptionPlanId,

} from '../config/subscription-config';

import { useSubscriptionUsage, useTenantEntitlements, useTenantSubscription } from '../hooks/useSubscription';



function isServerFeatureAllowed(state: string | undefined): boolean {

  return state === 'enabled' || state === 'limited';

}



export function useSubscriptionEntitlements() {

  const usage = useSubscriptionUsage();

  const tenantSubscription = useTenantSubscription();

  const serverEntitlements = useTenantEntitlements();

  const ai = useAiSubscription();



  const planId = useMemo<SubscriptionPlanId>(() => {

    const raw =

      serverEntitlements.data?.license.uiPlan ??

      tenantSubscription.data?.uiPlan ??

      usage.dashboard?.subscription?.plan ??

      ai.planName;

    return resolveSubscriptionPlanId(raw);

  }, [

    serverEntitlements.data?.license.uiPlan,

    tenantSubscription.data?.uiPlan,

    usage.dashboard?.subscription?.plan,

    ai.planName,

  ]);



  const limits = useMemo(() => {

    const effective = serverEntitlements.data?.license.effectiveLimits;

    if (effective) {

      return {

        maxUsers: effective.maxUsers,

        maxBranches: effective.maxBranches,

        maxPatients: effective.maxPatients,

        maxStorageGb: effective.maxStorageGb,

        maxReportsPerMonth: effective.maxReportsPerMonth,

        maxApiRequestsPerDay: effective.maxApiRequestsPerDay,

        maxAppointmentsPerMonth: effective.maxAppointmentsPerMonth,

      };

    }

    if (tenantSubscription.data?.limits) {

      const base = tenantSubscription.data.limits;

      return {

        maxUsers: base.maxUsers,

        maxBranches: base.maxBranches,

        maxPatients: base.maxPatients,

        maxStorageGb: base.maxStorageGb,

        maxReportsPerMonth: base.maxReportsPerMonth,

        maxApiRequestsPerDay: base.maxApiRequestsPerDay,

        maxAppointmentsPerMonth: base.maxAppointmentsPerMonth,

      };

    }

    return getPlanLimits(planId);

  }, [planId, serverEntitlements.data?.license.effectiveLimits, tenantSubscription.data?.limits]);



  const subscription = tenantSubscription.data ?? usage.dashboard?.subscription;

  const license = serverEntitlements.data?.license;

  const entitlementsVerified =
    serverEntitlements.isSuccess && serverEntitlements.data != null;
  const safeMode =
    serverEntitlements.isError ||
    (!serverEntitlements.isLoading && !entitlementsVerified);

  const canUseFeature = (featureId: string): boolean => {

    const serverState = license?.features?.[featureId];

    if (serverState) return isServerFeatureAllowed(serverState);

    if (safeMode || serverEntitlements.isLoading) return false;

    return isFeatureEnabled(featureId, planId);

  };

  const canUseModule = (moduleId: string): boolean => {

    const access = license?.modules?.[moduleId];

    if (access) return access === 'enabled' || access === 'preview';

    if (safeMode || serverEntitlements.isLoading) return false;

    return false;

  };

  return {

    planId,

    limits,

    subscription,

    license,

    usageLimits: serverEntitlements.data?.usageLimits ?? [],

    canWrite: entitlementsVerified ? (serverEntitlements.data?.canWrite ?? false) : false,

    canMutate: entitlementsVerified ? (serverEntitlements.data?.canMutate ?? false) : false,

    safeMode,

    entitlementsVerified,

    aiLimits: ai.limits,

    isLoading:

      usage.isLoading ||

      tenantSubscription.isLoading ||

      serverEntitlements.isLoading ||

      ai.isLoading,

    canUseFeature,

    canUseModule,

    canUseAi: ai.canUse,

    quotaExceeded: ai.quotaExceeded,

    trialDaysRemaining: computeTrialDays(license?.trialEndsAt ?? subscription?.endDate, license?.status ?? subscription?.status),

    graceDaysRemaining: computeGraceDays(license?.gracePeriodEndsAt, license?.status),

  };

}



function computeTrialDays(endDate: string | null | undefined, status: string | undefined): number {

  if (status?.toLowerCase() !== 'trial' || !endDate) return 0;

  const end = new Date(endDate).getTime();

  const now = Date.now();

  return Math.max(0, Math.ceil((end - now) / 86_400_000));

}



function computeGraceDays(endDate: string | null | undefined, status: string | undefined): number {

  if (status?.toLowerCase() !== 'grace' || !endDate) return 0;

  const end = new Date(endDate).getTime();

  const now = Date.now();

  return Math.max(0, Math.ceil((end - now) / 86_400_000));

}

