import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { DEFAULT_TENANT_ID } from '@/lib/api-client';
import { verifyEmailRequest } from '@/lib/auth-api';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthLayout } from './components/AuthLayout';
import { AuthAlert } from './components/AuthAlert';
import { AuthButton } from './components/AuthButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import shared from './auth-shared.module.css';

const verifyEmailOnce = (() => {
  const inflight = new Map<string, Promise<{ message: string }>>();
  return (token: string, tenantId: string) => {
    const key = `${tenantId}:${token}`;
    const existing = inflight.get(key);
    if (existing) return existing;
    const request = verifyEmailRequest({ token, tenantId }).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, request);
    return request;
  };
})();

export function VerifyEmailPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const tenantId = params.get('tenantId') ?? DEFAULT_TENANT_ID;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );
  const [error, setError] = useState<string | null>(token ? null : t('auth.verifyMissingToken'));

  useEffect(() => {
    if (!token || !online) return;

    let cancelled = false;
    void (async () => {
      try {
        await verifyEmailOnce(token, tenantId);
        if (!cancelled) {
          setStatus('success');
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(
            isNetworkError(err)
              ? t('auth.networkError')
              : getApiErrorMessage(err, t('auth.verifyError'), t),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tenantId, online, t]);

  async function retryVerification(e: FormEvent) {
    e.preventDefault();
    if (!token || !online) {
      setError(t('auth.offline'));
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      await verifyEmailOnce(token, tenantId);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(
        isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('auth.verifyError'), t),
      );
    }
  }

  return (
    <AuthLayout title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle')}>
      {status === 'success' && (
        <AuthAlert variant="success" title={t('auth.verifySuccessTitle')}>
          {t('auth.verifySuccessBody')}
        </AuthAlert>
      )}

      {status === 'error' && error && <AuthAlert variant="error">{error}</AuthAlert>}

      {status === 'loading' && (
        <p role="status">{t('auth.verifyLoading')}</p>
      )}

      <div className={shared.actions}>
        {status === 'success' ? (
          <AuthButton
            type="button"
            fullWidth
            onClick={() => navigate('/login', { replace: true, state: { verifySuccess: true } })}
          >
            {t('auth.backToLogin')}
          </AuthButton>
        ) : (
          <form onSubmit={retryVerification}>
            <AuthButton
              type="submit"
              fullWidth
              loading={status === 'loading'}
              disabled={!token || !online}
            >
              {t('auth.verifyRetry')}
            </AuthButton>
          </form>
        )}
      </div>

      <p className={shared.linkRow}>
        <Link className={shared.link} to="/login">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
