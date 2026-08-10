import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: string | null;
  required?: boolean;
  children: ReactNode;
}

/**
 * Label + control + error/hint wrapper. If `htmlFor` is omitted, an id is
 * generated and injected into the single child control automatically.
 */
export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const errorId = error ? `${controlId}-error` : undefined;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control =
    !htmlFor && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: controlId,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : undefined,
          required,
        })
      : children;

  return (
    <div className="sa-field">
      <label htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="sa-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="sa-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
