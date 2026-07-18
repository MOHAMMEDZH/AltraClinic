import { FormEvent, useCallback, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  confirmMfaRequest,
  disableMfaRequest,
  regenerateMfaBackupCodesRequest,
  setupMfaRequest,
} from '@/lib/auth-api';
import { formatMessage } from '@/i18n/messages';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthAlert } from '../components/AuthAlert';
import { AuthButton } from '../components/AuthButton';
import { AuthFormField } from '../components/AuthFormField';
import { PasswordInput } from '../components/PasswordInput';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './SecurityLayout.module.css';

const CODE_LENGTH = 6;

export function MfaSettingsPage() {
  const { t } = useI18n();
  const { user, getValidAccessToken, refreshUser } = useAuth();
  const online = useOnlineStatus();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const code = digits.join('');
  const mfaEnabled = user?.mfaEnabled ?? false;
  const mfaPending = user?.mfaPending ?? false;

  const focusIndex = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < CODE_LENGTH - 1) focusIndex(index + 1);
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) focusIndex(index - 1);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    setDigits(Array(CODE_LENGTH).fill('').map((_, i) => pasted[i] ?? ''));
    focusIndex(Math.min(pasted.length, CODE_LENGTH - 1));
  }

  async function beginSetup() {
    if (!online) {
      setMessage({ type: 'error', text: t('auth.offline') });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await setupMfaRequest(token);
      setSetup({ secret: result.secret, otpauthUrl: result.otpauthUrl });
      setDigits(Array(CODE_LENGTH).fill(''));
      await refreshUser();
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.mfaSetupError'), t),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmSetup(e: FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await confirmMfaRequest(token, code);
      setSetup(null);
      setDigits(Array(CODE_LENGTH).fill(''));
      if (result.backupCodes.length > 0) {
        setBackupCodes(result.backupCodes);
      }
      await refreshUser();
      setMessage({ type: 'success', text: t('security.mfaEnabledSuccess') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.mfaConfirmError'), t),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function disableMfa(e: FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || !password) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      await disableMfaRequest(token, { password, code });
      setPassword('');
      setDigits(Array(CODE_LENGTH).fill(''));
      setSetup(null);
      setBackupCodes(null);
      setShowRegenerate(false);
      await refreshUser();
      setMessage({ type: 'success', text: t('security.mfaDisabledSuccess') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.mfaDisableError'), t),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function regenerateBackupCodes(e: FormEvent) {
    e.preventDefault();
    if (code.length < 6 || !password) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await regenerateMfaBackupCodesRequest(token, { password, code });
      setBackupCodes(result.backupCodes);
      setPassword('');
      setDigits(Array(CODE_LENGTH).fill(''));
      setShowRegenerate(false);
      await refreshUser();
      setMessage({ type: 'success', text: t('security.mfaRegenerateBackupSuccess') });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.mfaRegenerateBackupError'), t),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.mfaTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.mfaDesc')}</p>

      {mfaEnabled ? (
        <AuthAlert variant="success">{t('security.mfaStatusEnabled')}</AuthAlert>
      ) : mfaPending ? (
        <AuthAlert variant="info">{t('security.mfaStatusPending')}</AuthAlert>
      ) : (
        <AuthAlert variant="info">{t('security.mfaStatusDisabled')}</AuthAlert>
      )}

      {message && (
        <AuthAlert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</AuthAlert>
      )}

      {backupCodes && backupCodes.length > 0 && (
        <AuthAlert variant="warning" title={t('security.mfaBackupCodesTitle')}>
          <p>{t('security.mfaBackupCodesDesc')}</p>
          <p>{t('security.mfaBackupCodesWarning')}</p>
          <ul className={styles.backupCodesList}>
            {backupCodes.map((entry) => (
              <li key={entry} className={styles.backupCodeItem} dir="ltr">
                {entry}
              </li>
            ))}
          </ul>
          <AuthButton type="button" variant="secondary" onClick={() => setBackupCodes(null)}>
            {t('security.mfaCancelSetup')}
          </AuthButton>
        </AuthAlert>
      )}

      {mfaEnabled && !backupCodes && (
        <p className={styles.panelDesc}>
          {formatMessage(t('security.mfaBackupCodesRemaining'), {
            count: user?.mfaBackupCodesRemaining ?? 0,
          })}
        </p>
      )}

      {!mfaEnabled && !setup && (
        <div className={styles.formActions}>
          <AuthButton type="button" onClick={() => void beginSetup()} loading={submitting} disabled={!online}>
            {t('security.mfaBeginSetup')}
          </AuthButton>
        </div>
      )}

      {!mfaEnabled && setup && (
        <form className={styles.formStack} onSubmit={confirmSetup}>
          <p>{t('security.mfaScanInstructions')}</p>
          <AuthFormField
            label={t('security.mfaSecretLabel')}
            value={setup.secret}
            readOnly
            dir="ltr"
            onChange={() => undefined}
          />
          <p className={styles.panelDesc}>
            <a href={setup.otpauthUrl}>{t('security.mfaOpenAuthenticator')}</a>
          </p>
          <div className={styles.otpRow} role="group" aria-label={t('auth.mfaCodeLabel')}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className={styles.otpInput}
                inputMode="numeric"
                maxLength={1}
                value={digit}
                aria-label={`${t('auth.mfaDigit')} ${index + 1}`}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(index, e)}
                onPaste={handlePaste}
                dir="ltr"
              />
            ))}
          </div>
          <div className={styles.formActions}>
            <AuthButton type="submit" loading={submitting} disabled={code.length !== CODE_LENGTH || !online}>
              {t('security.mfaConfirmSetup')}
            </AuthButton>
            <AuthButton
              type="button"
              variant="secondary"
              onClick={() => setSetup(null)}
              disabled={submitting}
            >
              {t('security.mfaCancelSetup')}
            </AuthButton>
          </div>
        </form>
      )}

      {mfaEnabled && (
        <>
          {!showRegenerate ? (
            <div className={styles.formActions}>
              <AuthButton type="button" variant="secondary" onClick={() => setShowRegenerate(true)}>
                {t('security.mfaRegenerateBackupCodes')}
              </AuthButton>
            </div>
          ) : (
            <form className={styles.formStack} onSubmit={regenerateBackupCodes}>
              <p>{t('security.mfaDisableInstructions')}</p>
              <PasswordInput
                label={t('auth.currentPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className={styles.otpRow} role="group" aria-label={t('auth.mfaCodeLabel')}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    className={styles.otpInput}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    aria-label={`${t('auth.mfaDigit')} ${index + 1}`}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={handlePaste}
                    dir="ltr"
                  />
                ))}
              </div>
              <div className={styles.formActions}>
                <AuthButton
                  type="submit"
                  loading={submitting}
                  disabled={!online || !password || code.length !== CODE_LENGTH}
                >
                  {t('security.mfaRegenerateBackupCodes')}
                </AuthButton>
                <AuthButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRegenerate(false)}
                  disabled={submitting}
                >
                  {t('security.mfaCancelSetup')}
                </AuthButton>
              </div>
            </form>
          )}

          <form className={styles.formStack} onSubmit={disableMfa}>
          <p>{t('security.mfaDisableInstructions')}</p>
          <PasswordInput
            label={t('auth.currentPassword')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className={styles.otpRow} role="group" aria-label={t('auth.mfaCodeLabel')}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className={styles.otpInput}
                inputMode="numeric"
                maxLength={1}
                value={digit}
                aria-label={`${t('auth.mfaDigit')} ${index + 1}`}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(index, e)}
                onPaste={handlePaste}
                dir="ltr"
              />
            ))}
          </div>
          <AuthButton
            type="submit"
            variant="danger"
            loading={submitting}
            disabled={!online || !password || code.length !== CODE_LENGTH}
          >
            {t('security.mfaDisable')}
          </AuthButton>
        </form>
        </>
      )}
    </section>
  );
}
