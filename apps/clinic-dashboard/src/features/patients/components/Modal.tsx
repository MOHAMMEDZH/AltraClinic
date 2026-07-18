import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  closeLabel?: string;
}

export function Modal({ open, title, onClose, children, footer, size = 'md', closeLabel = 'Close' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (open) return;
    const target = previouslyFocusedRef.current;
    if (target?.isConnected) {
      target.focus();
    }
    previouslyFocusedRef.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={[styles.dialog, styles[size]].join(' ')}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={closeLabel}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  );
}
