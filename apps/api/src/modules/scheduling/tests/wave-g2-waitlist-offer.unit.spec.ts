/**
 * Wave G2 / P1-10 — WaitlistOffer lifecycle + auto-book flag (unit).
 */
import {
  canAcceptOffer,
  canRejectOffer,
  computeOfferExpiresAt,
  isOfferExpiredAt,
  resolveOfferStatusAt,
} from '../domain/waitlist-offer.lifecycle';
import {
  isWaitlistAutoBookEnabled,
  WAITLIST_AUTO_BOOK_FLAG,
} from '../domain/booking-feature-flags';

describe('Wave G2 WaitlistOffer lifecycle (unit)', () => {
  const base = {
    status: 'PENDING' as const,
    expiresAt: new Date('2026-09-08T12:00:00.000Z'),
    deletedAt: null as Date | null,
  };

  it('G2-TTL-01 — PENDING before expiresAt is acceptable', () => {
    const now = new Date('2026-09-08T11:59:59.000Z');
    expect(canAcceptOffer(base, now)).toBe(true);
    expect(canRejectOffer(base, now)).toBe(true);
    expect(isOfferExpiredAt(base, now)).toBe(false);
    expect(resolveOfferStatusAt(base, now)).toBe('PENDING');
  });

  it('G2-TTL-02 — PENDING at/after expiresAt cannot be accepted', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    expect(canAcceptOffer(base, now)).toBe(false);
    expect(isOfferExpiredAt(base, now)).toBe(true);
    expect(resolveOfferStatusAt(base, now)).toBe('EXPIRED');
  });

  it('G2-TTL-03 — ACCEPTED/REJECTED/EXPIRED are not re-acceptable', () => {
    const now = new Date('2026-09-08T11:00:00.000Z');
    expect(canAcceptOffer({ ...base, status: 'ACCEPTED' }, now)).toBe(false);
    expect(canAcceptOffer({ ...base, status: 'REJECTED' }, now)).toBe(false);
    expect(canAcceptOffer({ ...base, status: 'EXPIRED' }, now)).toBe(false);
  });

  it('G2-TTL-04 — computeOfferExpiresAt respects TTL minutes', () => {
    const created = new Date('2026-09-08T10:00:00.000Z');
    expect(computeOfferExpiresAt(created, 15).toISOString()).toBe(
      '2026-09-08T10:15:00.000Z',
    );
  });

  it('G2-POLICY-01 — waitlist.auto_book defaults OFF', () => {
    expect(isWaitlistAutoBookEnabled(null)).toBe(false);
    expect(isWaitlistAutoBookEnabled({})).toBe(false);
    expect(isWaitlistAutoBookEnabled({ [WAITLIST_AUTO_BOOK_FLAG]: false })).toBe(false);
    expect(isWaitlistAutoBookEnabled({ [WAITLIST_AUTO_BOOK_FLAG]: true })).toBe(true);
  });
});
