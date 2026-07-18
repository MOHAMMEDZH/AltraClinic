import { FormEvent, useState, useId } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { changePasswordRequest } from '@/lib/auth-api';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { clearDeviceTrust } from '@/lib/auth-storage';
import { isPasswordValid, passwordsMatch } from '@/lib/password-policy';
import { AuthAlert } from '../components/AuthAlert';
import { AuthButton } from '../components/AuthButton';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import shared from '../auth-shared.module.css';
import styles from './SecurityLayout.module.css';

export function ChangePasswordPage() {
  const { t } = useI18n();
  const { getValidAccessToken } = useAuth();
  const online = useOnlineStatus();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strengthMeterId = useId();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError(t('auth.offline'));
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setError(t('auth.passwordPolicy'));
      return;
    }
    if (!passwordsMatch(newPassword, confirm)) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('auth.passwordSameAsCurrent'));
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await changePasswordRequest(token, { currentPassword, newPassword });
      setSuccess(
        result.revokedOtherSessions > 0
          ? formatMessage(t('security.passwordChangedWithSessions'), {
              count: result.revokedOtherSessions,
            })
          : t('security.passwordChanged'),
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      clearDeviceTrust();
    } catch (err) {
      const message = isNetworkError(err)
        ? t('auth.networkError')
        : getApiErrorMessage(err, t('security.passwordChangeError'));
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.changePasswordTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.changePasswordDesc')}</p>

      <form className={shared.formStack} onSubmit={onSubmit}>
        <PasswordInput
          label={t('auth.currentPassword')}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <PasswordInput
          label={t('auth.newPassword')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          describedBy={newPassword ? strengthMeterId : undefined}
        />
        <PasswordStrengthMeter id={strengthMeterId} password={newPassword} />
        <PasswordInput
          label={t('auth.confirmPassword')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          error={confirm && !passwordsMatch(newPassword, confirm) ? t('auth.passwordMismatch') : null}
        />

        {success && (
          <AuthAlert variant="success" title={t('security.passwordChangedTitle')}>
            {success}
          </AuthAlert>
        )}
        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        <div className={styles.formActions}>
          <AuthButton
            type="submit"
            loading={submitting}
            disabled={
              !online ||
              !currentPassword ||
              !isPasswordValid(newPassword) ||
              !passwordsMatch(newPassword, confirm)
            }
          >
            {t('security.changePasswordSubmit')}
          </AuthButton>
        </div>
      </form>
    </section>
  );
}
