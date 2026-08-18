export type AccountableStaffOption = {
  id: string;
  label: string;
};

export function staffOptionLabel(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const full = input.fullName?.trim();
  if (full) return full;
  const name = `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim();
  if (name) return name;
  return input.email?.trim() || '';
}

/**
 * Merge the current authenticated user (as a selectable option, never pre-selected)
 * with tenant directory users when identity view is available.
 */
export function mergeAccountableStaffOptions(input: {
  currentUser: { id: string; label: string } | null;
  directoryUsers: Array<{ id: string; fullName?: string | null; email?: string | null }>;
}): AccountableStaffOption[] {
  const byId = new Map<string, AccountableStaffOption>();
  if (input.currentUser?.id) {
    byId.set(input.currentUser.id, {
      id: input.currentUser.id,
      label: input.currentUser.label || input.currentUser.id,
    });
  }
  for (const user of input.directoryUsers) {
    if (!user.id || byId.has(user.id)) continue;
    byId.set(user.id, {
      id: user.id,
      label: staffOptionLabel(user) || user.id,
    });
  }
  return [...byId.values()];
}
