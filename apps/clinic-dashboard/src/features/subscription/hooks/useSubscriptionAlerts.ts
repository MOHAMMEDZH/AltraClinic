import { useMemo } from 'react';
import { usagePercent } from '../config/subscription-config';
import { useSubscriptionEntitlements } from './useSubscriptionEntitlements';
import { useSubscriptionUsage } from './useSubscription';

export type SubscriptionAlertSeverity = 'info' | 'warning' | 'danger';

export interface SubscriptionAlert {
  id: string;
  severity: SubscriptionAlertSeverity;
  messageKey: string;
  href?: string;
}

export function useSubscriptionAlerts() {
  const entitlements = useSubscriptionEntitlements();
  const usage = useSubscriptionUsage();

  const alerts = useMemo(() => {
    const items: SubscriptionAlert[] = [];
    const sub = entitlements.subscription;

    if (entitlements.trialDaysRemaining > 0 && entitlements.trialDaysRemaining <= 7) {
      items.push({
        id: 'trial-ending',
        severity: 'warning',
        messageKey: 'subscription.notifications.trialEnding',
        href: '/settings/subscription/plans',
      });
    }

    if (entitlements.graceDaysRemaining > 0) {
      items.push({
        id: 'grace-period',
        severity: 'danger',
        messageKey: 'subscription.notifications.gracePeriod',
        href: '/settings/subscription/payments',
      });
    }

    if ((usage.billing?.overdueCount ?? 0) > 0) {
      items.push({
        id: 'payment-failed',
        severity: 'danger',
        messageKey: 'subscription.notifications.paymentFailed',
        href: '/settings/subscription/payments',
      });
    }

    if ((usage.billing?.outstandingAmount ?? 0) > 0) {
      items.push({
        id: 'payment-due',
        severity: 'warning',
        messageKey: 'subscription.notifications.paymentDue',
        href: '/settings/subscription/invoices',
      });
    }

    const userPct = usagePercent(usage.dashboard?.live.activeUsers ?? 0, entitlements.limits.maxUsers);
    if (userPct >= 80) {
      items.push({
        id: 'user-limit',
        severity: userPct >= 95 ? 'danger' : 'warning',
        messageKey: 'subscription.notifications.userLimit',
        href: '/settings/subscription/usage',
      });
    }

    if (entitlements.quotaExceeded) {
      items.push({
        id: 'ai-limit',
        severity: 'danger',
        messageKey: 'subscription.notifications.aiLimit',
        href: '/settings/subscription/ai-usage',
      });
    }

    if (sub?.endDate) {
      const daysToRenewal = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86_400_000);
      if (daysToRenewal > 0 && daysToRenewal <= 14) {
        items.push({
          id: 'renewal-reminder',
          severity: 'info',
          messageKey: 'subscription.notifications.renewalReminder',
          href: '/settings/subscription/license',
        });
      }
    }

    if (entitlements.planId !== 'enterprise' && entitlements.planId !== 'business') {
      items.push({
        id: 'upgrade-recommendation',
        severity: 'info',
        messageKey: 'subscription.notifications.upgradeRecommendation',
        href: '/settings/subscription/plans',
      });
    }

    return items;
  }, [entitlements, usage.billing, usage.dashboard?.live.activeUsers]);

  return { alerts, isLoading: usage.isLoading || entitlements.isLoading };
}
