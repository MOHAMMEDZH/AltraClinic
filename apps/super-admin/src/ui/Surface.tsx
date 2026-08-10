import type { ElementType, HTMLAttributes, ReactNode } from 'react';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  level?: 'base' | 'raised' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: ElementType;
}

/** Card-like container using semantic surface/border tokens. */
export function Surface({
  children,
  level = 'base',
  padding = 'md',
  as: Component = 'div',
  className,
  ...rest
}: SurfaceProps) {
  const classes = ['sa-surface', `sa-surface-${level}`, `sa-surface-padding-${padding}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
