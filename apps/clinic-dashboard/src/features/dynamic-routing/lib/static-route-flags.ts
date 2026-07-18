/** When true, use the legacy static router tree (rollback / instant revert). */
export function isRegistryRoutingEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_ROUTES_ONLY;
  return flag !== 'true' && flag !== '1';
}
