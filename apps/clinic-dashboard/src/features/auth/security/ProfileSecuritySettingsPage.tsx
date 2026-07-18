import { FormEvent, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { resendVerificationRequest } from '@/lib/auth-api';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthAlert } from '../components/AuthAlert';
import { AuthButton } from '../components/AuthButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './SecurityLayout.module.css';

export function ProfileSecuritySettingsPage() {
  const { t } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const online = useOnlineStatus();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function resendVerification(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setMessage({ type: 'error', text: t('auth.offline') });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      await resendVerificationRequest(token);
      setMessage({ type: 'success', text: t('security.verificationSent') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.verificationError'), t),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.profileTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.profileDesc')}</p>

      <dl style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div>
          <dt style={{ fontWeight: 600 }}>{t('security.email')}</dt>
          <dd style={{ margin: 0, color: 'var(--color-text-secondary)' }} dir="ltr">
            {user?.email ?? '—'}
            {' · '}
            <span className={user?.emailVerified ? styles.statusVerified : styles.statusUnverified}>
              {user?.emailVerified ? t('security.emailVerified') : t('security.emailUnverified')}
            </span>
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600 }}>{t('security.userId')}</dt>
          <dd style={{ margin: 0, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }} dir="ltr">
            {user?.userId}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600 }}>{t('security.tenantId')}</dt>
          <dd style={{ margin: 0, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }} dir="ltr">
            {user?.tenantId}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600 }}>{t('security.roles')}</dt>
          <dd style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            {user?.roles.join(', ') ?? '—'}
          </dd>
        </div>
      </dl>

      {message && (
        <AuthAlert variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </AuthAlert>
      )}

      {!user?.emailVerified && (
        <form onSubmit={resendVerification}>
          <AuthButton type="submit" variant="secondary" loading={submitting} disabled={!online}>
            {t('security.resendVerification')}
          </AuthButton>
        </form>
      )}
    </section>
  );
}
