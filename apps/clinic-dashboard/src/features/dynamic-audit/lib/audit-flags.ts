/** Registry audit pipeline enabled unless VITE_USE_STATIC_AUDIT_ONLY is set. */
export function isRegistryAuditEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_AUDIT_ONLY;
  return flag !== 'true' && flag !== '1';
}
