import type { ElementType, HTMLAttributes, ReactNode } from 'react';

type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface StackProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  as?: ElementType;
}

/** Vertical flex layout primitive with token-based spacing. */
export function Stack({ children, gap = 'md', align, as: Component = 'div', className, ...rest }: StackProps) {
  const classes = ['sa-stack', `sa-stack-gap-${gap}`, align ? `sa-stack-align-${align}` : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
