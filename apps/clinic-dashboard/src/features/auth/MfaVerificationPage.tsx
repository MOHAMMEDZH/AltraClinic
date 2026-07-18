import {
  FormEvent,
  useCallback,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { getMfaChallenge } from '@/lib/auth-storage';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthLayout } from './components/AuthLayout';
import { AuthAlert } from './components/AuthAlert';
import { AuthButton } from './components/AuthButton';
import { AuthFormField } from './components/AuthFormField';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import shared from './auth-shared.module.css';
import styles from './security/SecurityLayout.module.css';

const CODE_LENGTH = 6;

export function MfaVerificationPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { completeMfa, isAuthenticated, isLoading } = useAuth();
  const online = useOnlineStatus();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [backupCode, setBackupCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const challenge = getMfaChallenge();

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const code = useBackupCode ? backupCode.trim() : digits.join('');
  const hasError = Boolean(error);
  const canSubmit = useBackupCode ? backupCode.trim().length >= 8 : code.length === CODE_LENGTH;

  const focusIndex = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (error) setError(null);
    if (digit && index < CODE_LENGTH - 1) focusIndex(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusIndex(index - 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH)
      .fill('')
      .map((_, i) => pasted[i] ?? '');
    setDigits(next);
    if (error) setError(null);
    focusIndex(Math.min(pasted.length, CODE_LENGTH - 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      setError(t('auth.offline'));
      return;
    }
    if (!canSubmit) {
      setError(useBackupCode ? t('auth.mfaBackupIncomplete') : t('auth.mfaIncomplete'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await completeMfa(code, { trustDevice: !useBackupCode && trustDevice });
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('auth.mfaVerifyError'), t),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={t('auth.mfaTitle')} subtitle={t('auth.mfaSubtitle')}>
      <form className={shared.formStack} onSubmit={onSubmit}>
        {useBackupCode ? (
          <AuthFormField
            label={t('auth.mfaBackupLabel')}
            value={backupCode}
            onChange={(e) => {
              setBackupCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            autoComplete="off"
            dir="ltr"
            helpText={t('auth.mfaBackupHint')}
          />
        ) : (
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend className="sr-only">{t('auth.mfaTitle')}</legend>
            <div
              className={styles.otpRow}
              role="group"
              aria-label={t('auth.mfaCodeLabel')}
              aria-describedby={hasError ? 'mfa-error' : undefined}
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className={styles.otpInput}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  aria-label={`${t('auth.mfaDigit')} ${index + 1}`}
                  aria-invalid={hasError || undefined}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  dir="ltr"
                />
              ))}
            </div>
          </fieldset>
        )}

        {!useBackupCode && (
          <label className={styles.trustDeviceLabel}>
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
            />
            <span>{t('auth.mfaTrustDevice')}</span>
          </label>
        )}

        {error && (
          <AuthAlert id="mfa-error" variant="error">
            {error}
          </AuthAlert>
        )}

        <AuthButton
          type="submit"
          fullWidth
          loading={submitting}
          loadingLabel={t('auth.mfaVerifying')}
          disabled={!online || !canSubmit}
        >
          {t('auth.mfaVerify')}
        </AuthButton>

        <button
          type="button"
          className={shared.link}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onClick={() => {
            setUseBackupCode((value) => !value);
            setError(null);
            setDigits(Array(CODE_LENGTH).fill(''));
            setBackupCode('');
          }}
        >
          {useBackupCode ? t('auth.mfaUseAuthenticator') : t('auth.mfaUseBackupCode')}
        </button>
      </form>

      <p className={shared.linkRow}>
        <Link className={shared.link} to="/login">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
