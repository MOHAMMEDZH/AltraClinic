import { useI18n } from '@booking/i18n/react';
import { useSuperAdminConfig } from '../app/providers/ConfigProvider';
import type { SuperAdminRuntimeEnv } from '../config/runtime-config';
import { VisuallyHidden } from '../ui/VisuallyHidden';

const ENV_LABEL_KEY: Record<SuperAdminRuntimeEnv, string> = {
  development: 'shell.environment.local',
  test: 'shell.environment.test',
  production: 'shell.environment.production',
};

const ENV_LABEL_FALLBACK: Record<SuperAdminRuntimeEnv, string> = {
  development: 'Local',
  test: 'Test',
  production: 'Production',
};

/**
 * Environment indicator. Always renders text (never relies on color alone)
 * so the current environment is legible to everyone, including screen
 * reader users and anyone with color vision deficiency.
 */
export function EnvironmentBadge() {
  const config = useSuperAdminConfig();
  const { t } = useI18n();
  const label = t(ENV_LABEL_KEY[config.environment], ENV_LABEL_FALLBACK[config.environment]);

  return (
    <span className={`sa-env-badge sa-env-badge-${config.environment}`}>
      <VisuallyHidden>Environment: </VisuallyHidden>
      {label}
    </span>
  );
}
