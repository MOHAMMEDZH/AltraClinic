import type { ElementType, HTMLAttributes, ReactNode } from 'react';

type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface InlineProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  gap?: Gap;
  align?: 'start' | 'center' | 'end';
  wrap?: boolean;
  as?: ElementType;
}

/** Horizontal flex layout primitive with token-based spacing. */
export function Inline({
  children,
  gap = 'md',
  align = 'center',
  wrap = true,
  as: Component = 'div',
  className,
  ...rest
}: InlineProps) {
  const classes = [
    'sa-inline',
    `sa-inline-gap-${gap}`,
    `sa-inline-align-${align}`,
    wrap ? 'sa-inline-wrap' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
