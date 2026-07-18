export function isRegistryWhiteLabelEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_WHITE_LABEL_ONLY;
  return flag !== 'true' && flag !== '1';
}
