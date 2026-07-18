export function isRegistryAnalyticsEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_ANALYTICS_ONLY;
  return flag !== 'true' && flag !== '1';
}
