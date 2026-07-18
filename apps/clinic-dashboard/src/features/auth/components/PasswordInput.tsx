import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes } from 'react';
import { useI18n } from '@booking/i18n/react';
import styles from './AuthFormField.module.css';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string | null;
  helpText?: string;
  /** Extra element ids referenced by aria-describedby (e.g. password strength meter). */
  describedBy?: string;
}

export function PasswordInput({
  label,
  error,
  helpText,
  describedBy,
  id,
  ...inputProps
}: PasswordInputProps) {
  const { t } = useI18n();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const errorId = error ? `${fieldId}-error` : undefined;
  const helpId = helpText ? `${fieldId}-help` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={[styles.input, error ? styles.inputError : ''].filter(Boolean).join(' ')}
          style={{ paddingInlineEnd: '2.75rem' }}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, helpId, describedBy].filter(Boolean).join(' ') || undefined}
          dir="ltr"
          {...inputProps}
        />
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {helpText && (
        <p id={helpId} className={styles.helpText}>
          {helpText}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
