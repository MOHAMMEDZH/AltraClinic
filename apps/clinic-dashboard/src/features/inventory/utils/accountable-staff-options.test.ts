import { describe, expect, it } from 'vitest';
import { mergeAccountableStaffOptions, staffOptionLabel } from './accountable-staff-options';

describe('mergeAccountableStaffOptions', () => {
  const current = { id: 'user-current', label: 'Inventory Manager' };
  const other = { id: 'user-other', fullName: 'Dr Other', email: 'other@demo.clinic' };

  it('includes current user as a selectable option without requiring directory access', () => {
    const options = mergeAccountableStaffOptions({
      currentUser: current,
      directoryUsers: [],
    });
    expect(options).toEqual([{ id: 'user-current', label: 'Inventory Manager' }]);
  });

  it('merges directory users and does not duplicate the current user', () => {
    const options = mergeAccountableStaffOptions({
      currentUser: current,
      directoryUsers: [other, { id: current.id, fullName: 'Dup', email: 'dup@demo.clinic' }],
    });
    expect(options.map((o) => o.id)).toEqual(['user-current', 'user-other']);
    expect(options.find((o) => o.id === 'user-current')?.label).toBe('Inventory Manager');
  });

  it('does not preselect anyone — empty currentUser yields only directory rows', () => {
    expect(
      mergeAccountableStaffOptions({
        currentUser: null,
        directoryUsers: [other],
      }),
    ).toEqual([{ id: 'user-other', label: 'Dr Other' }]);
  });

  it('builds labels from name or email', () => {
    expect(staffOptionLabel({ firstName: 'Ann', lastName: 'Lee', email: 'a@x' })).toBe('Ann Lee');
    expect(staffOptionLabel({ email: 'only@x' })).toBe('only@x');
  });
});
