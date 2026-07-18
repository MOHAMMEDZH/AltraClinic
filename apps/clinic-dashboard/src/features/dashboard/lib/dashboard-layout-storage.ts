import type { DashboardProfileId, DashboardWidgetId } from '../config/dashboard-config';

export const DASHBOARD_LAYOUT_VERSION = 1;

export interface DashboardLayoutPrefs {
  version: typeof DASHBOARD_LAYOUT_VERSION;
  hiddenWidgets: DashboardWidgetId[];
  widgetOrder: DashboardWidgetId[];
}

function storageKey(userId: string, tenantId: string, profile: DashboardProfileId): string {
  return `booking.dashboard.layout.v${DASHBOARD_LAYOUT_VERSION}.${tenantId}.${userId}.${profile}`;
}

export function loadDashboardLayout(
  userId: string | undefined,
  tenantId: string | undefined,
  profile: DashboardProfileId,
): DashboardLayoutPrefs | null {
  if (!userId || !tenantId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId, tenantId, profile));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardLayoutPrefs;
    if (parsed.version !== DASHBOARD_LAYOUT_VERSION) return null;
    if (!Array.isArray(parsed.hiddenWidgets) || !Array.isArray(parsed.widgetOrder)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDashboardLayout(
  userId: string,
  tenantId: string,
  profile: DashboardProfileId,
  prefs: Omit<DashboardLayoutPrefs, 'version'>,
): void {
  const payload: DashboardLayoutPrefs = { version: DASHBOARD_LAYOUT_VERSION, ...prefs };
  localStorage.setItem(storageKey(userId, tenantId, profile), JSON.stringify(payload));
}

export function clearDashboardLayout(
  userId: string,
  tenantId: string,
  profile: DashboardProfileId,
): void {
  localStorage.removeItem(storageKey(userId, tenantId, profile));
}

/** Apply saved hide/order on top of role-default widget ids. */
export function applyLayoutPreferences(
  widgetIds: DashboardWidgetId[],
  prefs: DashboardLayoutPrefs | null,
): DashboardWidgetId[] {
  const allowed = new Set(widgetIds);
  const hidden = new Set((prefs?.hiddenWidgets ?? []).filter((id) => allowed.has(id)));
  const visible = widgetIds.filter((id) => !hidden.has(id));

  const savedOrder = (prefs?.widgetOrder ?? []).filter((id) => allowed.has(id) && !hidden.has(id));
  if (savedOrder.length === 0) return visible;

  const rank = new Map(savedOrder.map((id, index) => [id, index]));
  return [...visible].sort((a, b) => {
    const ar = rank.get(a);
    const br = rank.get(b);
    if (ar !== undefined && br !== undefined) return ar - br;
    if (ar !== undefined) return -1;
    if (br !== undefined) return 1;
    return widgetIds.indexOf(a) - widgetIds.indexOf(b);
  });
}

export function createDefaultLayoutPrefs(widgetIds: DashboardWidgetId[]): DashboardLayoutPrefs {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    hiddenWidgets: [],
    widgetOrder: [...widgetIds],
  };
}

export function toggleWidgetVisibility(
  prefs: DashboardLayoutPrefs,
  widgetId: DashboardWidgetId,
  visible: boolean,
): DashboardLayoutPrefs {
  const hidden = new Set(prefs.hiddenWidgets);
  if (visible) hidden.delete(widgetId);
  else hidden.add(widgetId);
  return { ...prefs, hiddenWidgets: [...hidden] };
}

export function moveWidgetInOrder(
  prefs: DashboardLayoutPrefs,
  widgetId: DashboardWidgetId,
  direction: 'up' | 'down',
): DashboardLayoutPrefs {
  const order = [...prefs.widgetOrder];
  const index = order.indexOf(widgetId);
  if (index < 0) return prefs;
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= order.length) return prefs;
  [order[index], order[swapWith]] = [order[swapWith], order[index]];
  return { ...prefs, widgetOrder: order };
}
