/** Registry journey pipeline enabled unless rollback flag is active. */
export function isRegistryJourneyEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_JOURNEY_ONLY;
  return flag !== 'true' && flag !== '1';
}

