const TENANT_ADMIN_ROLES = new Set(['owner', 'general_manager', 'super_admin']);

export function canManageTenantPrompt(userRoles: string[]): boolean {
  return userRoles.some((r) => TENANT_ADMIN_ROLES.has(r));
}

export function canEditPrompt(
  userId: string,
  userRoles: string[],
  prompt: { userId: string | null },
): boolean {
  if (prompt.userId === userId) return true;
  if (prompt.userId === null && canManageTenantPrompt(userRoles)) return true;
  return false;
}

export function canDeletePrompt(
  userId: string,
  userRoles: string[],
  prompt: { userId: string | null },
): boolean {
  if (prompt.userId === userId) return true;
  if (prompt.userId === null && canManageTenantPrompt(userRoles)) return true;
  return false;
}

export function matchesPromptRoles(promptRoles: string[], userRoles: string[]): boolean {
  if (!promptRoles.length) return true;
  if (!userRoles.length) return false;
  return promptRoles.some((r) => userRoles.includes(r));
}
