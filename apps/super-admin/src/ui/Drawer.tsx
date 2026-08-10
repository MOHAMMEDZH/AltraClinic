import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from './useFocusTrap';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: 'start' | 'end';
}

/** Modal drawer (mobile navigation, side panels). Focus-trapped with Escape + backdrop-click to close. */
export function Drawer({ open, title, onClose, children, side = 'start' }: DrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(containerRef, open, onClose);

  if (!open) return null;

  return (
    <div
      className="sa-drawer-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`sa-drawer sa-drawer-${side}`}
      >
        <h2 id={titleId} className="sa-visually-hidden">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
