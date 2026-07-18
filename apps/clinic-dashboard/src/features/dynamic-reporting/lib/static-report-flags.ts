export function isRegistryReportingEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_REPORTING_ONLY;
  return flag !== 'true' && flag !== '1';
}
