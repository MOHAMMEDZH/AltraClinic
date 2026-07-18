import { describe, expect, it } from 'vitest';
import { getFocusableElements } from './ai-a11y';

function mockEl(overrides: Partial<HTMLElement> & { id: string }) {
  return {
    hasAttribute: (name: string) => name === 'disabled' && overrides.id === 'disabled',
    getAttribute: (name: string) => (name === 'aria-hidden' ? null : null),
    tabIndex: 0,
    ...overrides,
  } as unknown as HTMLElement;
}

describe('ai-a11y', () => {
  it('collects enabled focusable elements and skips disabled', () => {
    const root = {
      querySelectorAll: () =>
        [mockEl({ id: 'a' }), mockEl({ id: 'disabled' }), mockEl({ id: 'c' })] as unknown as NodeListOf<HTMLElement>,
    } as unknown as HTMLElement;

    const focusable = getFocusableElements(root);
    expect(focusable.map((el) => (el as { id: string }).id)).toEqual(['a', 'c']);
  });
});
