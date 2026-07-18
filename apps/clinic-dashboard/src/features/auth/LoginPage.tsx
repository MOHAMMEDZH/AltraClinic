import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { useI18n } from '@booking/i18n/react';
import { DEFAULT_TENANT_ID } from '@/lib/api-client';
import { getStoredTenantId, setStoredTenantId } from '@/lib/auth-storage';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthLayout } from './components/AuthLayout';
import { AuthFormField } from './components/AuthFormField';
import { PasswordInput } from './components/PasswordInput';
import { AuthAlert } from './components/AuthAlert';
import { AuthButton } from './components/AuthButton';
import { detectDeviceName } from './hooks/useTenantId';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import shared from './auth-shared.module.css';

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const resetSuccess = (location.state as { resetSuccess?: boolean } | null)?.resetSuccess;
  const verifySuccess = (location.state as { verifySuccess?: boolean } | null)?.verifySuccess;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState(getStoredTenantId() ?? DEFAULT_TENANT_ID);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError(t('auth.offline'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      setStoredTenantId(tenantId);
      const outcome = await login({
        email: email.trim(),
        password,
        tenantId: tenantId.trim(),
        deviceName: detectDeviceName(),
      });
      if (outcome === 'mfa_required') {
        navigate('/mfa', { replace: true, state: { from } });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      const message = isNetworkError(err)
        ? t('auth.networkError')
        : getApiErrorMessage(err, t('auth.error'), t);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.login')}
      subtitle={t('auth.loginSubtitle')}
      footer={<span>{t('auth.footerCompliance')}</span>}
    >
      {resetSuccess && (
        <AuthAlert variant="success" title={t('auth.resetSuccessTitle')}>
          {t('auth.resetSuccessBody')}
        </AuthAlert>
      )}

      {verifySuccess && (
        <AuthAlert variant="success" title={t('auth.verifySuccessTitle')}>
          {t('auth.verifySuccessBody')}
        </AuthAlert>
      )}

      <form className={shared.formStack} onSubmit={onSubmit} noValidate>
        <AuthFormField
          label={t('auth.tenantId')}
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
          autoComplete="organization"
          helpText={t('auth.tenantHint')}
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
        />

        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link className={shared.inlineLink} to="/forgot-password">
            {t('auth.forgotLink')}
          </Link>
        </div>

        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        <div className={shared.actions}>
          <AuthButton type="submit" fullWidth loading={submitting} disabled={!online}>
            {submitting ? t('auth.loggingIn') : t('auth.submit')}
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}
