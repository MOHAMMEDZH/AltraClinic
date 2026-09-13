/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NamedIdentityDisplay, truncateIdentityId } from './NamedIdentityDisplay';

describe('NamedIdentityDisplay', () => {
  const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  afterEach(() => cleanup());

  it('truncates ids for secondary display', () => {
    expect(truncateIdentityId(id)).toBe('aaaaaaaa…');
  });

  it('shows name primary and truncated id secondary when name is present', () => {
    render(<NamedIdentityDisplay id={id} name="Dr. Ada" fieldLabel="Provider" idClassName="mono" />);
    expect(screen.getByText('Dr. Ada')).toBeTruthy();
    expect(screen.getByText('aaaaaaaa…')).toBeTruthy();
    expect(screen.getByLabelText(`Provider: Dr. Ada (${id})`)).toBeTruthy();
  });

  it('fail-closed: UUID-only when name is missing', () => {
    render(<NamedIdentityDisplay id={id} name={null} fieldLabel="Provider" idClassName="mono" />);
    expect(screen.queryByText('Dr. Ada')).toBeNull();
    expect(screen.getByLabelText(`Provider: ${id}`)).toBeTruthy();
    expect(screen.getByText('aaaaaaaa…')).toBeTruthy();
  });
});
