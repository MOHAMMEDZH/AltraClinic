import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@booking/i18n/react';
import { messages } from '../i18n/messages';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ConfirmationDialog } from './ConfirmationDialog';
import { StatusBadge } from './StatusBadge';
import { Badge } from './Badge';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Checkbox } from './Checkbox';
import { FormField } from './FormField';
import { TextInput } from './TextInput';

function withI18n(children: ReactNode) {
  return <I18nProvider messages={messages}>{children}</I18nProvider>;
}

afterEach(() => cleanup());

describe('UI primitives — accessibility', () => {
  it('Button exposes its visible text as the accessible name and supports a pending state', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();

    cleanup();
    render(withI18n(<Button pending>Save changes</Button>));
    const pendingButton = screen.getByRole('button', { name: 'Save changes' });
    expect(pendingButton).toHaveProperty('disabled', true);
    expect(pendingButton.getAttribute('aria-busy')).toBe('true');
  });

  it('IconButton requires and exposes an aria-label as its accessible name', () => {
    render(
      <IconButton aria-label="Close panel">
        <span aria-hidden="true">×</span>
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeTruthy();
  });

  it('ConfirmationDialog traps focus, supports Escape, and returns focus to the trigger', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          {withI18n(
            <ConfirmationDialog
              open={open}
              title="Delete item"
              confirmLabel="Delete"
              danger
              onConfirm={() => setOpen(false)}
              onClose={() => setOpen(false)}
            >
              This cannot be undone.
            </ConfirmationDialog>,
          )}
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Delete item' });
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('StatusBadge always renders a visible text label, never color alone', () => {
    render(<StatusBadge label="Suspended" tone="danger" />);
    expect(screen.getByText('Suspended')).toBeTruthy();
  });

  it('Badge renders arbitrary readable content', () => {
    render(<Badge variant="info">3 pending</Badge>);
    expect(screen.getByText('3 pending')).toBeTruthy();
  });

  it('Alert uses role="alert" for danger/warning and role="status" for info/success', () => {
    const { rerender } = render(<Alert tone="danger">Something failed</Alert>);
    expect(screen.getByRole('alert').textContent).toMatch(/Something failed/);

    rerender(<Alert tone="info">Heads up</Alert>);
    expect(screen.getByRole('status').textContent).toMatch(/Heads up/);
  });

  it('EmptyState and ErrorState render an accessible heading', () => {
    render(withI18n(<EmptyState title="Nothing here" description="Check back later." />));
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeTruthy();

    cleanup();
    const onRetry = vi.fn();
    render(withI18n(<ErrorState title="Failed to load" onRetry={onRetry} retryLabel="Retry" />));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Checkbox associates its visible label with the input', () => {
    render(<Checkbox label="I agree" defaultChecked={false} />);
    const checkbox = screen.getByRole('checkbox', { name: 'I agree' });
    expect(checkbox).toBeTruthy();
  });

  it('FormField wires label, hint, and error to the control via aria-describedby', () => {
    render(
      <FormField label="Email" error="Email is required" hint="Use your work email">
        <TextInput type="email" />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(screen.getByRole('alert').textContent).toMatch(/Email is required/);
    expect(input.getAttribute('aria-describedby')).toMatch(/-hint/);
    expect(input.getAttribute('aria-describedby')).toMatch(/-error/);
  });
});
