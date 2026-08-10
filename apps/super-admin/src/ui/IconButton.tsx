import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only buttons must always carry an accessible name. */
  'aria-label': string;
  children: ReactNode;
  variant?: 'quiet' | 'secondary';
}

/** Icon-only button. Always requires `aria-label` at the type level. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, variant = 'quiet', className, type = 'button', ...rest },
  ref,
) {
  const classes = ['sa-icon-button', `sa-icon-button-${variant}`, className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
});
