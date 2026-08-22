import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { roundMoney, splitByShares } from '../services/money-rounding';
import { assertNoAppointmentProviderBlindAttribution } from '../services/commission-accrual.service';

describe('Wave F money / attribution helpers', () => {
  describe('roundMoney (half-up)', () => {
    it('rounds .005 up to next cent', () => {
      expect(roundMoney('1.005').toString()).toBe('1.01');
      expect(roundMoney(new Prisma.Decimal('10.125')).toString()).toBe('10.13');
    });

    it('rounds .004 down', () => {
      expect(roundMoney('1.004').toString()).toBe('1');
      expect(roundMoney('2.994').toString()).toBe('2.99');
    });

    it('preserves exact 2dp values', () => {
      expect(roundMoney('100.00').toFixed(2)).toBe('100.00');
    });
  });

  describe('splitByShares (residual to last)', () => {
    it('assigns residual to the last share so parts sum to target', () => {
      const parts = splitByShares(100, [33.33, 33.33, 33.34]);
      expect(parts).toHaveLength(3);
      expect(parts[0]!.toString()).toBe('33.33');
      expect(parts[1]!.toString()).toBe('33.33');
      const sum = parts.reduce((a, p) => a.add(p), new Prisma.Decimal(0));
      expect(sum.toString()).toBe('100');
      expect(parts[2]!.toString()).toBe('33.34');
    });

    it('splits 60/40 without double-count drift', () => {
      const parts = splitByShares('1000.00', [60, 40]);
      expect(parts[0]!.toFixed(2)).toBe('600.00');
      expect(parts[1]!.toFixed(2)).toBe('400.00');
      expect(parts[0]!.add(parts[1]!).toFixed(2)).toBe('1000.00');
    });

    it('handles single share', () => {
      expect(splitByShares(250, [100])[0]!.toFixed(2)).toBe('250.00');
    });

    it('returns empty for empty shares', () => {
      expect(splitByShares(100, [])).toEqual([]);
    });
  });

  describe('assertNoAppointmentProviderBlindAttribution', () => {
    it('rejects provider-blind attribution via appointmentProviderId', () => {
      expect(() =>
        assertNoAppointmentProviderBlindAttribution({
          appointmentProviderId: '00000000-0000-4000-8000-000000000001',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects attributionSource mentioning appointment.provider', () => {
      expect(() =>
        assertNoAppointmentProviderBlindAttribution({
          attributionSource: 'Appointment.providerId',
        }),
      ).toThrow(/Blind Appointment\.providerId/i);
    });

    it('allows participant-only attribution', () => {
      expect(assertNoAppointmentProviderBlindAttribution()).toEqual({
        ok: true,
        rule: 'ServicePerformanceParticipant only; Appointment.providerId never attributes commission',
      });
    });
  });
});
