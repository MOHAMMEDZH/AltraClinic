import type { NavItemDefinition } from '@booking/permissions';

export type NavigationPlacement = 'sidebar' | 'settings' | 'quickNav' | 'topNav';

/** Resolved navigation node derived exclusively from EffectiveModuleView extensions. */
export interface NavigationTreeItem {
  id: string;
  extensionId: string;
  moduleId: string;
  path: string;
  labelKey: string;
  icon: string;
  placement: NavigationPlacement;
  sortOrder: number;
  resourceId?: string;
  parentExtensionId?: string;
  userAccessible: boolean;
  lockReason?: string;
  badge?: 'new' | 'beta' | 'locked';
  children?: NavigationTreeItem[];
}

export interface NavigationSnapshot {
  generatedAt: string;
  catalogGeneration: number | null;
  source: 'registry' | 'static-fallback';
  sidebar: NavigationTreeItem[];
  settings: NavigationTreeItem[];
  topNav: NavigationTreeItem[];
  quickNav: NavigationTreeItem[];
}

/** Sidebar-compatible projection for existing Sidebar component. */
export type SidebarNavItem = NavItemDefinition;

export interface NavigationResolveOptions {
  roles: string[];
  /** Migration shim: path → required roles (from static nav metadata only). */
  roleConstraintsByPath?: Record<string, string[]>;
  /** When true, only include items the user can navigate to (matches static filterNavItems). */
  accessibleOnly?: boolean;
}
