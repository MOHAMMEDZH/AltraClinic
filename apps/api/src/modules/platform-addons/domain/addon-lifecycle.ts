import type {
  AddOnLifecycle,
  AddOnVersionLifecycle,
  CommercialOverrideLifecycle,
} from '../platform-addons.tokens';

const ADDON_ALLOWED: Record<AddOnLifecycle, readonly AddOnLifecycle[]> = {
  DRAFT: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

const VERSION_ALLOWED: Record<AddOnVersionLifecycle, readonly AddOnVersionLifecycle[]> = {
  DRAFT: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [], // clone to new Draft — never restore
};

export function canTransitionAddOnLifecycle(from: AddOnLifecycle, to: AddOnLifecycle): boolean {
  if (from === to) return false;
  return ADDON_ALLOWED[from].includes(to);
}

export function canTransitionAddOnVersionLifecycle(
  from: AddOnVersionLifecycle,
  to: AddOnVersionLifecycle,
): boolean {
  if (from === to) return false;
  return VERSION_ALLOWED[from].includes(to);
}

export function isAddOnVersionMutable(lifecycle: AddOnVersionLifecycle): boolean {
  return lifecycle === 'DRAFT';
}

/** Override maker-checker lifecycle transitions. */
const OVERRIDE_ALLOWED: Record<
  CommercialOverrideLifecycle,
  readonly CommercialOverrideLifecycle[]
> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['REVOKED', 'EXPIRED'],
  REJECTED: [],
  REVOKED: [],
  EXPIRED: [],
};

export function canTransitionOverrideLifecycle(
  from: CommercialOverrideLifecycle,
  to: CommercialOverrideLifecycle,
): boolean {
  if (from === to) return false;
  return OVERRIDE_ALLOWED[from].includes(to);
}

export function isOverrideMutable(lifecycle: CommercialOverrideLifecycle): boolean {
  return lifecycle === 'DRAFT';
}
