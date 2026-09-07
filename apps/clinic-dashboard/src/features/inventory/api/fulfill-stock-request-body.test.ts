import { describe, expect, it } from 'vitest';
import {
  ACCOUNTABLE_STAFF_REQUIRED,
  assertAccountableStaffSelected,
  buildFulfillStockRequestLineBody,
} from './fulfill-stock-request-body';

describe('buildFulfillStockRequestLineBody', () => {
  const selected = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const currentUser = '11111111-2222-4333-8444-555555555555';

  it('serializes quantity, usedByUserId, and optional notes', () => {
    expect(
      buildFulfillStockRequestLineBody({
        quantity: 3,
        usedByUserId: selected,
        notes: 'issue to ward',
      }),
    ).toEqual({
      quantity: 3,
      usedByUserId: selected,
      notes: 'issue to ward',
    });
  });

  it('omits empty notes so existing optional notes behavior is preserved', () => {
    expect(
      buildFulfillStockRequestLineBody({
        quantity: 1,
        usedByUserId: selected,
        notes: '  ',
      }),
    ).toEqual({ quantity: 1, usedByUserId: selected });
  });

  it('blocks missing selection instead of sending empty usedByUserId', () => {
    expect(() =>
      buildFulfillStockRequestLineBody({ quantity: 2, usedByUserId: '' }),
    ).toThrow(ACCOUNTABLE_STAFF_REQUIRED);
    expect(() =>
      buildFulfillStockRequestLineBody({ quantity: 2, usedByUserId: '   ' }),
    ).toThrow(ACCOUNTABLE_STAFF_REQUIRED);
    expect(() =>
      buildFulfillStockRequestLineBody({ quantity: 2, usedByUserId: null }),
    ).toThrow(ACCOUNTABLE_STAFF_REQUIRED);
  });

  it('sends the selected UUID, not the current user, when they differ', () => {
    const body = buildFulfillStockRequestLineBody({
      quantity: 2,
      usedByUserId: selected,
    });
    expect(body.usedByUserId).toBe(selected);
    expect(body.usedByUserId).not.toBe(currentUser);
  });

  it('sends the current user only when that UUID was explicitly selected', () => {
    expect(
      buildFulfillStockRequestLineBody({
        quantity: 1,
        usedByUserId: currentUser,
      }).usedByUserId,
    ).toBe(currentUser);
  });

  it('does not inject a current-user fallback when selection is missing', () => {
    expect(() => assertAccountableStaffSelected(undefined)).toThrow(ACCOUNTABLE_STAFF_REQUIRED);
    expect(() => assertAccountableStaffSelected(currentUser)).not.toThrow();
  });
});
