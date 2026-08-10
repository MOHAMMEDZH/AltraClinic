import type { ElementType, ReactNode } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
  as?: ElementType;
}

/** Renders content only accessible to assistive technology. */
export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return <Component className="sa-visually-hidden">{children}</Component>;
}
