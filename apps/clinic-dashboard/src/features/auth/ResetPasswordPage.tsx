import { FormEvent, useMemo, useState, useId } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useI18n } from '@booking/i18n/react';

import { DEFAULT_TENANT_ID } from '@/lib/api-client';

import { resetPasswordRequest } from '@/lib/auth-api';

import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';

import { isPasswordValid, passwordsMatch } from '@/lib/password-policy';

import { AuthLayout } from './components/AuthLayout';

import { PasswordInput } from './components/PasswordInput';

import { PasswordStrengthMeter } from './components/PasswordStrengthMeter';

import { AuthAlert } from './components/AuthAlert';

import { AuthButton } from './components/AuthButton';

import { useOnlineStatus } from './hooks/useOnlineStatus';

import shared from './auth-shared.module.css';



export function ResetPasswordPage() {

  const { t } = useI18n();

  const navigate = useNavigate();

  const online = useOnlineStatus();

  const [params] = useSearchParams();

  const token = params.get('token') ?? '';

  const tenantId = params.get('tenantId') ?? DEFAULT_TENANT_ID;



  const [password, setPassword] = useState('');

  const [confirm, setConfirm] = useState('');

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const strengthMeterId = useId();



  const validationError = useMemo(() => {

    if (!token) return t('auth.resetMissingToken');

    if (password && !isPasswordValid(password)) return t('auth.passwordPolicy');

    if (confirm && !passwordsMatch(password, confirm)) return t('auth.passwordMismatch');

    return null;

  }, [token, password, confirm, t]);



  async function onSubmit(e: FormEvent) {

    e.preventDefault();

    if (!online) {

      setError(t('auth.offline'));

      return;

    }

    if (validationError) {

      setError(validationError);

      return;

    }

    setError(null);

    setSubmitting(true);

    try {

      await resetPasswordRequest({ token, newPassword: password, tenantId });

      navigate('/login', { replace: true, state: { resetSuccess: true } });

    } catch (err) {

      const message = isNetworkError(err)

        ? t('auth.networkError')

        : getApiErrorMessage(err, t('auth.resetError'));

      setError(message);

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>

      <form className={shared.formStack} onSubmit={onSubmit}>

        <PasswordInput

          label={t('auth.newPassword')}

          value={password}

          onChange={(e) => setPassword(e.target.value)}

          required

          autoComplete="new-password"

          describedBy={password ? strengthMeterId : undefined}

        />

        <PasswordStrengthMeter id={strengthMeterId} password={password} />

        <PasswordInput

          label={t('auth.confirmPassword')}

          value={confirm}

          onChange={(e) => setConfirm(e.target.value)}

          required

          autoComplete="new-password"

          error={confirm && !passwordsMatch(password, confirm) ? t('auth.passwordMismatch') : null}

        />

        {(error || validationError) && (

          <AuthAlert variant="error">{error ?? validationError}</AuthAlert>

        )}

        <AuthButton

          type="submit"

          fullWidth

          loading={submitting}

          disabled={

            !online ||

            !token ||

            !isPasswordValid(password) ||

            !passwordsMatch(password, confirm)

          }

        >

          {t('auth.resetSubmit')}

        </AuthButton>

      </form>



      <p className={shared.linkRow}>

        <Link className={shared.link} to="/login">

          {t('auth.backToLogin')}

        </Link>

      </p>

    </AuthLayout>

  );

}


