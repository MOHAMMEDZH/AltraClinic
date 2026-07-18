/** When true, use the legacy static search catalog path (rollback / instant revert). */
export function isRegistrySearchEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_SEARCH_ONLY;
  return flag !== 'true' && flag !== '1';
}
