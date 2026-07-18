import { useMemo } from 'react';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import {
  aiFeatureEnabled,
  featureAllowedByWorkspaces,
  resolveAiPlanTier,
} from '../config/ai-subscription';
import type { AiFeatureKey } from '../config/ai-config';
import { useAiSubscriptionLimits } from './useAiChat';

export function useAiSubscription() {
  const { data: dashboard, isLoading: dashboardLoading } = useDashboardOverview(undefined, '7d');
  const limitsQuery = useAiSubscriptionLimits();
  const tier = useMemo(
    () => resolveAiPlanTier(limitsQuery.data?.plan ?? dashboard?.subscription?.plan),
    [limitsQuery.data?.plan, dashboard?.subscription?.plan],
  );

  const canUse = (feature: AiFeatureKey) => {
    if (limitsQuery.data?.limits.workspaces) {
      return featureAllowedByWorkspaces(limitsQuery.data.limits.workspaces, feature);
    }
    return aiFeatureEnabled(tier, feature);
  };

  return {
    tier,
    planName: limitsQuery.data?.plan ?? dashboard?.subscription?.plan ?? 'lite',
    isLoading: dashboardLoading || limitsQuery.isLoading,
    limits: limitsQuery.data,
    attachmentsEnabled: limitsQuery.data?.limits.attachmentsEnabled ?? false,
    externalProvidersEnabled: limitsQuery.data?.limits.externalProvidersEnabled ?? false,
    customPromptsEnabled: limitsQuery.data?.limits.customPromptsEnabled ?? false,
    canUse,
    hasChat: canUse('chat'),
    hasAdminModels: canUse('admin') || tier === 'enterprise',
    canCreateCustomPrompts: limitsQuery.data?.limits.customPromptsEnabled ?? canUse('custom_prompts'),
    quotaExceeded:
      limitsQuery.data != null &&
      limitsQuery.data.limits.maxMessagesPerUserPerDay > 0 &&
      limitsQuery.data.messagesToday >= limitsQuery.data.limits.maxMessagesPerUserPerDay,
  };
}
