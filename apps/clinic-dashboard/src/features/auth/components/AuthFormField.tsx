import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import styles from './AuthFormField.module.css';

interface AuthFormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string | null;
  helpText?: string;
  labelAction?: ReactNode;
  inputClassName?: string;
  children?: ReactNode;
}

export function AuthFormField({
  label,
  error,
  helpText,
  labelAction,
  inputClassName,
  id,
  children,
  ...inputProps
}: AuthFormFieldProps) {
  const fieldId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helpId = helpText ? `${fieldId}-help` : undefined;
  const inputClass = [styles.input, error ? styles.inputError : '', inputClassName].filter(Boolean).join(' ');
  const ariaProps = {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [errorId, helpId].filter(Boolean).join(' ') || undefined,
  };

  let control: ReactNode;
  if (children != null) {
    control = isValidElement(children)
      ? cloneElement(children as ReactElement<{ id?: string; className?: string }>, {
          id: (children as ReactElement<{ id?: string }>).props.id ?? fieldId,
          className: [(children as ReactElement<{ className?: string }>).props.className, inputClass]
            .filter(Boolean)
            .join(' '),
          ...ariaProps,
        })
      : children;
  } else {
    control = <input id={fieldId} className={inputClass} {...ariaProps} {...inputProps} />;
  }

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
        {labelAction}
      </div>
      {control}
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
