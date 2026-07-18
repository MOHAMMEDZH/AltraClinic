import { SubscriptionGrantHistoryEntry } from '../../domain/types/tenant-license.types';

export type { SubscriptionGrantHistoryEntry };

export function readGrantHistory(features: Record<string, unknown>): SubscriptionGrantHistoryEntry[] {
  const grants = (features.subscriptionGrants ?? {}) as Record<string, unknown>;
  const history = grants.history;
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      action: String(entry.action ?? entry.grantType ?? 'grant'),
      grantType: entry.grantType ? String(entry.grantType) : undefined,
      amount: entry.amount != null ? Number(entry.amount) : undefined,
      plan: entry.plan ? String(entry.plan) : undefined,
      days: entry.days != null ? Number(entry.days) : undefined,
      note: entry.note != null ? String(entry.note) : null,
      grantedBy: String(entry.grantedBy ?? ''),
      at: String(entry.at ?? new Date().toISOString()),
    }));
}

export function appendGrantHistory(
  features: Record<string, unknown>,
  entry: SubscriptionGrantHistoryEntry,
): Record<string, unknown> {
  const next = { ...features };
  const grants = { ...((next.subscriptionGrants ?? {}) as Record<string, unknown>) };
  const history = Array.isArray(grants.history) ? [...grants.history] : [];
  history.unshift(entry);
  grants.history = history.slice(0, 100);
  next.subscriptionGrants = grants;
  return next;
}
