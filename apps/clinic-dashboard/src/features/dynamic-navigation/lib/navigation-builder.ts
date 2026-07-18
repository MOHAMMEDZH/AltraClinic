import type { SidebarNavItem } from './navigation-types';
import type { NavigationSnapshot, NavigationTreeItem } from './navigation-types';

export function buildNavigationTree(items: NavigationTreeItem[]): NavigationTreeItem[] {
  const roots = items.filter((item) => !item.parentExtensionId);
  const byParent = new Map<string, NavigationTreeItem[]>();

  for (const item of items) {
    if (!item.parentExtensionId) continue;
    const list = byParent.get(item.parentExtensionId) ?? [];
    list.push(item);
    byParent.set(item.parentExtensionId, list);
  }

  return roots.map((root) => ({
    ...root,
    children: (byParent.get(root.extensionId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export function toSidebarNavItems(items: NavigationTreeItem[]): SidebarNavItem[] {
  return items.map((item) => ({
    id: item.id,
    path: item.path,
    labelKey: item.labelKey,
    icon: item.icon,
    resourceId: item.resourceId,
  }));
}

export function buildNavigationSnapshot(input: {
  catalogGeneration: number | null;
  source: NavigationSnapshot['source'];
  sidebar: NavigationTreeItem[];
  settings: NavigationTreeItem[];
  topNav: NavigationTreeItem[];
  quickNav: NavigationTreeItem[];
}): NavigationSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    catalogGeneration: input.catalogGeneration,
    source: input.source,
    sidebar: input.sidebar,
    settings: input.settings,
    topNav: input.topNav,
    quickNav: input.quickNav,
  };
}
