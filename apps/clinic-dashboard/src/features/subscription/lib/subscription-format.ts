import { formatMessage } from '@/i18n/messages';

export function formatSubscription(t: (key: string) => string, key: string, vars?: Record<string, string | number>): string {
  const template = t(key);
  if (!vars) return template;
  return formatMessage(template, vars);
}
