import { Injectable } from '@nestjs/common';
import {
  LIFETIME_PERIOD_END,
  LIFETIME_PERIOD_START,
} from '../usage-metering.constants';
import type { UsagePeriodBounds, UsagePeriodType } from '../domain/usage-metering.types';
import { UsageMeteringError } from '../domain/usage-metering.types';

export type UsageClock = () => Date;

@Injectable()
export class UsagePeriodResolver {
  constructor(private readonly clock: UsageClock = () => new Date()) {}

  now(): Date {
    return this.clock();
  }

  resolve(periodType: UsagePeriodType, at: Date = this.now()): UsagePeriodBounds {
    if (periodType === 'LIFETIME') {
      return {
        periodType,
        periodStart: LIFETIME_PERIOD_START,
        periodEnd: LIFETIME_PERIOD_END,
      };
    }
    if (periodType === 'CALENDAR_MONTH') {
      const y = at.getUTCFullYear();
      const m = at.getUTCMonth();
      const periodStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
      const usageMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
      return { periodType, periodStart, periodEnd, usageMonth };
    }
    throw new UsageMeteringError('period_unsupported', `Unsupported period type: ${periodType}`);
  }

  assertNotFutureSkew(occurredAt: Date, maxSkewMs = 5 * 60 * 1000): void {
    const skew = occurredAt.getTime() - this.now().getTime();
    if (skew > maxSkewMs) {
      throw new UsageMeteringError('observation_future_rejected', 'Observation occurredAt is too far in the future');
    }
  }
}
