interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** Visual + semantic separator. */
export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  const classes = ['sa-divider', `sa-divider-${orientation}`, className].filter(Boolean).join(' ');
  return <div role="separator" aria-orientation={orientation} className={classes} />;
}
