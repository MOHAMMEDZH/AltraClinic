import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { NavigationPlacement, NavigationResolveOptions, NavigationTreeItem } from './navigation-types';
import { STATIC_NAV_ID_BY_PATH } from './static-nav-role-map';

interface NavigationContributionPayload {
  path: string;
  placement: NavigationPlacement;
  icon?: string;
  resourceId?: string;
  parentExtensionId?: string;
  badge?: 'new' | 'beta' | 'locked';
  userAccessible?: boolean;
}

function passesRoleConstraint(
  path: string,
  roles: string[],
  roleConstraintsByPath: Record<string, string[]>,
): boolean {
  const required = roleConstraintsByPath[path];
  if (!required?.length) return true;
  return required.some((role) => roles.includes(role));
}

function toTreeItem(
  module: EffectiveModuleView,
  extension: EffectiveModuleView['extensions'][number],
): NavigationTreeItem | null {
  if (extension.kind !== 'navigation') return null;
  const payload = extension.payload as unknown as NavigationContributionPayload;
  if (!payload.path || !payload.placement) return null;

  const userAccessible =
    typeof payload.userAccessible === 'boolean'
      ? payload.userAccessible
      : module.userAccessible && extension.userVisible;

  return {
    id: STATIC_NAV_ID_BY_PATH[payload.path] ?? extension.extensionId,
    extensionId: extension.extensionId,
    moduleId: module.moduleId as LicensedModuleId,
    path: payload.path,
    labelKey: extension.labelKey,
    icon: payload.icon ?? 'Circle',
    placement: payload.placement,
    sortOrder: extension.sortOrder,
    resourceId: payload.resourceId,
    parentExtensionId: payload.parentExtensionId,
    userAccessible,
    lockReason: userAccessible ? undefined : module.lockReason,
    badge: payload.badge,
  };
}

export function resolveNavigationItems(
  modules: EffectiveModuleView[],
  placement: NavigationPlacement,
  options: NavigationResolveOptions,
): NavigationTreeItem[] {
  const roleConstraints = options.roleConstraintsByPath ?? {};
  const items: NavigationTreeItem[] = [];

  for (const module of modules) {
    if (!module.userVisible) continue;
    for (const extension of module.extensions) {
      const item = toTreeItem(module, extension);
      if (!item || item.placement !== placement) continue;
      if (!extension.userVisible) continue;
      if (options.accessibleOnly !== false && !item.userAccessible) continue;
      if (!passesRoleConstraint(item.path, options.roles, roleConstraints)) continue;
      items.push(item);
    }
  }

  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}
