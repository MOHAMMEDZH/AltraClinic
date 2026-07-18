import { useRef, type ReactNode } from 'react';
import { useEscapeKey, useFocusTrap, useRestoreFocus } from '../../lib/ai-a11y';
import e from '../../ai-enterprise.module.css';

interface AiModalProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  maxWidth?: number;
}

export function AiModal({ open, label, onClose, children, panelClassName, maxWidth = 560 }: AiModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useRestoreFocus(open);
  useFocusTrap(dialogRef, open);
  useEscapeKey(open, onClose);

  if (!open) return null;

  return (
    <div className={e.commandOverlay} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={[e.commandPanel, panelClassName].filter(Boolean).join(' ')}
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(ev) => ev.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
