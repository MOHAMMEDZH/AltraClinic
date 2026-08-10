/**
 * Action-scoped readiness context for Step 16 commercial configurations.
 * Severity of lifecycle / tenant / future-effective codes depends on this action.
 */
export type SubscriptionReadinessAction =
  | 'edit'
  | 'schedule'
  | 'activate'
  | 'assign_plan'
  | 'assign_addons'
  | 'assign_overrides'
  | 'update_dates'
  | 'supersede'
  | 'renew'
  | 'preview';

const EDIT_ACTIONS: ReadonlySet<SubscriptionReadinessAction> = new Set([
  'edit',
  'assign_plan',
  'assign_addons',
  'assign_overrides',
  'update_dates',
]);

export function isEditReadinessAction(action: SubscriptionReadinessAction): boolean {
  return EDIT_ACTIONS.has(action);
}

export function parseSubscriptionReadinessAction(
  raw: string | undefined | null,
): SubscriptionReadinessAction {
  const value = (raw ?? 'activate').trim().toLowerCase().replace(/-/g, '_');
  const allowed: SubscriptionReadinessAction[] = [
    'edit',
    'schedule',
    'activate',
    'assign_plan',
    'assign_addons',
    'assign_overrides',
    'update_dates',
    'supersede',
    'renew',
    'preview',
  ];
  if ((allowed as string[]).includes(value)) {
    return value as SubscriptionReadinessAction;
  }
  return 'activate';
}

/**
 * Frozen override_future_effective severity:
 * - Draft composition / preview / edit / assign: WARNING (may remain on Draft)
 * - Immediate activate: BLOCKER when effectiveFrom > now
 * - Schedule: WARNING when scheduledActivationAt >= effectiveFrom; BLOCKER when
 *   scheduledActivationAt is missing or precedes effectiveFrom
 */
export type FutureEffectiveSeverity = 'warning' | 'blocker' | 'none';

export function futureEffectiveOverrideSeverity(input: {
  action: SubscriptionReadinessAction;
  effectiveFrom: Date;
  now: Date;
  scheduledActivationAt: Date | null;
}): FutureEffectiveSeverity {
  if (input.effectiveFrom <= input.now) return 'none';
  if (input.action === 'activate') return 'blocker';
  if (input.action === 'schedule') {
    if (
      input.scheduledActivationAt &&
      input.scheduledActivationAt.getTime() >= input.effectiveFrom.getTime()
    ) {
      return 'warning';
    }
    return 'blocker';
  }
  return 'warning';
}
