/** Registry branch pipeline enabled unless VITE_USE_STATIC_BRANCH_ONLY is set. */
export function isRegistryBranchEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_BRANCH_ONLY;
  return flag !== 'true' && flag !== '1';
}
