import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useFocusTrap } from './useFocusTrap';

export interface MenuItemDefinition {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuProps {
  /** Accessible name for the menu itself (`aria-label` on the `role="menu"` container). */
  label: string;
  /** Renders the trigger button; receives the props that must be spread onto it. */
  renderTrigger: (triggerProps: {
    ref: (node: HTMLButtonElement | null) => void;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => ReactNode;
  items: MenuItemDefinition[];
  align?: 'start' | 'end';
  /** Optional non-interactive content (e.g. identity summary) shown above the items. */
  header?: ReactNode;
}

/** Keyboard-navigable dropdown menu (arrow keys, Home/End, Escape, outside click). */
export function Menu({ label, renderTrigger, items, align = 'end', header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = () => setOpen(false);

  useFocusTrap(containerRef, open, close);

  useEffect(() => {
    if (!open) return undefined;
    function onOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveIndex(0);
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    }
  }

  return (
    <div className="sa-menu-root">
      {renderTrigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        onClick: () => setOpen((value) => !value),
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open ? (
        <div
          ref={containerRef}
          role="menu"
          aria-label={label}
          className={`sa-menu sa-menu-align-${align}`}
          onKeyDown={onMenuKeyDown}
        >
          {header ? (
            <div className="sa-menu-header" role="presentation">
              {header}
            </div>
          ) : null}
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={['sa-menu-item', item.danger ? 'sa-menu-item-danger' : null].filter(Boolean).join(' ')}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
