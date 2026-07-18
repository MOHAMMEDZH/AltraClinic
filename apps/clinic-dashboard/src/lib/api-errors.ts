import { ApiError } from './api-client';

import { formatMessage } from '@/i18n/messages';

const MESSAGE_KEY_MAP: Record<string, string> = {
  'Invalid email or password.': 'auth.errors.invalidCredentials',
  'Invalid verification code.': 'auth.errors.invalidMfaCode',
  'Your account has been deactivated. Contact your administrator.': 'auth.errors.accountInactive',
  'Please verify your email address before logging in.': 'auth.errors.emailNotVerified',
  'Password does not meet policy requirements.': 'auth.passwordPolicy',
  'reset password token is invalid or has been revoked.': 'auth.errors.resetTokenInvalid',
  'Reset token has expired.': 'auth.errors.resetTokenExpired',
  'MFA challenge token is invalid or has been revoked.': 'auth.errors.mfaChallengeExpired',
};

type TranslateFn = (key: string, fallback?: string) => string;

export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  t?: TranslateFn,
): string {
  const localize = (message: string): string => {
    if (!t) return message;
    const key = MESSAGE_KEY_MAP[message];
    return key ? t(key) : message;
  };

  if (err instanceof ApiError) {
    const body = err.body;
    if (
      typeof body === 'object' &&
      body !== null &&
      'violations' in body &&
      Array.isArray((body as { violations: unknown }).violations)
    ) {
      const violations = (body as { violations: string[] }).violations;
      if (violations.length > 0) return violations.map(localize).join(' ');
    }

    const lockedMatch = err.message.match(
      /Account is temporarily locked\. Try again in approximately (\d+) minute\(s\)\./,
    );
    if (lockedMatch && t) {
      return formatMessage(t('auth.errors.accountLocked'), { minutes: lockedMatch[1] ?? '1' });
    }

    const rateLimitMatch = err.message.match(/Please retry after (\d+) seconds\./);
    if (rateLimitMatch && t) {
      return formatMessage(t('auth.errors.rateLimited'), { seconds: rateLimitMatch[1] ?? '60' });
    }

    return localize(err.message || fallback);
  }
  if (err instanceof Error && err.message) return localize(err.message);
  return fallback;
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network/i.test(err.message);
}
