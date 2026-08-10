import { OPERATIONS_CONSOLE_ENABLED_ENV } from '../platform-operations-console.constants';

export const OPERATIONS_CONSOLE_DISABLED_CODE = 'operations_console_disabled';
export const OPERATIONS_CONSOLE_DISABLED_MESSAGE = 'Operations Console is disabled';

export function isOperationsConsoleEnabled(): boolean {
  const raw = (process.env[OPERATIONS_CONSOLE_ENABLED_ENV] ?? 'false').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
