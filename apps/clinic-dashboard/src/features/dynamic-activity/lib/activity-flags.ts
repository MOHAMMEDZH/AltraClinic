/** Registry activity pipeline enabled unless VITE_USE_STATIC_ACTIVITY_ONLY is set. */
export function isRegistryActivityEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_ACTIVITY_ONLY;
  return flag !== 'true' && flag !== '1';
}
