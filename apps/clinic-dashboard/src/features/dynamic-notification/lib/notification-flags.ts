/** Registry notification pipeline enabled unless rollback flag is active. */
export function isRegistryNotificationEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_NOTIFICATION_ONLY;
  return flag !== 'true' && flag !== '1';
}
