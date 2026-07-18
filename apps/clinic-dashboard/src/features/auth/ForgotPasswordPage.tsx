import { FormEvent, useState } from 'react';

import { Link } from 'react-router-dom';

import { useI18n } from '@booking/i18n/react';

import { DEFAULT_TENANT_ID } from '@/lib/api-client';

import { getStoredTenantId, setStoredTenantId } from '@/lib/auth-storage';

import { forgotPasswordRequest } from '@/lib/auth-api';

import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';

import { AuthLayout } from './components/AuthLayout';

import { AuthFormField } from './components/AuthFormField';

import { AuthAlert } from './components/AuthAlert';

import { AuthButton } from './components/AuthButton';

import { useOnlineStatus } from './hooks/useOnlineStatus';

import shared from './auth-shared.module.css';



export function ForgotPasswordPage() {

  const { t } = useI18n();

  const online = useOnlineStatus();

  const [email, setEmail] = useState('');

  const [tenantId, setTenantId] = useState(getStoredTenantId() ?? DEFAULT_TENANT_ID);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  const [submitting, setSubmitting] = useState(false);



  async function onSubmit(e: FormEvent) {

    e.preventDefault();

    if (!online) {

      setError(t('auth.offline'));

      return;

    }

    setError(null);

    setSuccess(false);

    setSubmitting(true);

    try {

      setStoredTenantId(tenantId);

      await forgotPasswordRequest({ email: email.trim(), tenantId: tenantId.trim() });

      setSuccess(true);

    } catch (err) {

      const message = isNetworkError(err)

        ? t('auth.networkError')

        : getApiErrorMessage(err, t('auth.forgotError'));

      setError(message);

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>

      {success ? (

        <AuthAlert variant="success" title={t('auth.forgotSuccessTitle')}>

          {t('auth.forgotSuccessBody')}

        </AuthAlert>

      ) : (

        <form className={shared.formStack} onSubmit={onSubmit}>

          <AuthFormField

            label={t('auth.tenantId')}

            value={tenantId}

            onChange={(e) => setTenantId(e.target.value)}

            required

            dir="ltr"

          />

          <AuthFormField

            label={t('auth.email')}

            type="email"

            value={email}

            onChange={(e) => setEmail(e.target.value)}

            required

            autoComplete="username"

            dir="ltr"

            helpText={t('auth.forgotHint')}

          />

          {error && <AuthAlert variant="error">{error}</AuthAlert>}

          <AuthButton type="submit" fullWidth loading={submitting} disabled={!online}>

            {t('auth.forgotSubmit')}

          </AuthButton>

        </form>

      )}



      <p className={shared.linkRow}>

        <Link className={shared.link} to="/login">

          {t('auth.backToLogin')}

        </Link>

      </p>

    </AuthLayout>

  );

}


