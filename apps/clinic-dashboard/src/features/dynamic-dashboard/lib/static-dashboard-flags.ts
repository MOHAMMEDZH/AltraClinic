/** When true, use the legacy static dashboard widget config (rollback / instant revert). */
export function isRegistryDashboardEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_DASHBOARD_ONLY;
  return flag !== 'true' && flag !== '1';
}
