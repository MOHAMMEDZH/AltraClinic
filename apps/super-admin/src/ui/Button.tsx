import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  pending?: boolean;
  pendingLabel?: string;
}

/** Base button primitive. `pending` disables the button and shows a spinner while keeping its label for screen readers. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', pending = false, pendingLabel, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const classes = ['sa-button', `sa-button-${variant}`, pending ? 'sa-button-pending' : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <Spinner size="sm" label={pendingLabel} decorative /> : null}
      <span className="sa-button-label">{children}</span>
    </button>
  );
});
