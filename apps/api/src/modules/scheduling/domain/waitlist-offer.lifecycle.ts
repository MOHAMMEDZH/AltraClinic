/**
 * Wave G / P1-10 — pure waitlist-offer lifecycle helpers.
 */

export type WaitlistOfferLifecycleStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED';

export interface WaitlistOfferClockView {
  status: WaitlistOfferLifecycleStatus;
  expiresAt: Date;
  deletedAt?: Date | null;
}

/** Default TTL when creating offers from cancel (minutes). */
export const DEFAULT_WAITLIST_OFFER_TTL_MINUTES = 15;

export function isOfferExpiredAt(offer: WaitlistOfferClockView, now: Date): boolean {
  if (offer.deletedAt) return true;
  if (offer.status === 'EXPIRED') return true;
  if (offer.status !== 'PENDING') return false;
  return offer.expiresAt.getTime() <= now.getTime();
}

/** Acceptable only while PENDING and before TTL. */
export function canAcceptOffer(offer: WaitlistOfferClockView, now: Date): boolean {
  if (offer.deletedAt) return false;
  if (offer.status !== 'PENDING') return false;
  return offer.expiresAt.getTime() > now.getTime();
}

export function canRejectOffer(offer: WaitlistOfferClockView, now: Date): boolean {
  return canAcceptOffer(offer, now);
}

export function resolveOfferStatusAt(
  offer: WaitlistOfferClockView,
  now: Date,
): WaitlistOfferLifecycleStatus {
  if (offer.status === 'PENDING' && isOfferExpiredAt(offer, now)) return 'EXPIRED';
  return offer.status;
}

export function computeOfferExpiresAt(
  createdAt: Date,
  ttlMinutes: number = DEFAULT_WAITLIST_OFFER_TTL_MINUTES,
): Date {
  const ttl = Math.min(Math.max(ttlMinutes, 1), 24 * 60);
  return new Date(createdAt.getTime() + ttl * 60_000);
}
