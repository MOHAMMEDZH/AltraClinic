import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { getMeterDefinition } from '../catalog/static-usage-meter.catalog';
import { UsagePeriodResolver } from './usage-period.resolver';
import { UsageMeteringError } from '../domain/usage-metering.types';

export type AggregateReadResult =
  | { ok: true; value: string }
  | { ok: false; code: 'SOURCE_UNAVAILABLE' | 'meter_unsupported'; message: string };

@Injectable()
export class UsageAggregateReaders {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: UsagePeriodResolver,
  ) {}

  async readExpected(tenantId: string, meterKey: string, at: Date = this.periods.now()): Promise<AggregateReadResult> {
    const def = getMeterDefinition(meterKey);
    if (!def) {
      return { ok: false, code: 'meter_unsupported', message: `Unknown meter: ${meterKey}` };
    }
    try {
      switch (meterKey) {
        case 'meter.max_users': {
          const n = await this.prisma.user.count({
            where: { tenantId, deletedAt: null, roles: { some: { role: { not: 'PATIENT' } } } },
          });
          return { ok: true, value: String(n) };
        }
        case 'meter.max_branches': {
          const n = await this.prisma.branch.count({
            where: { tenantId, deletedAt: null, isActive: true },
          });
          return { ok: true, value: String(n) };
        }
        case 'meter.max_patients': {
          const n = await this.prisma.patient.count({ where: { tenantId, deletedAt: null } });
          return { ok: true, value: String(n) };
        }
        case 'meter.max_storage_gb': {
          const mediaAssets = await this.prisma.mediaAsset.findMany({
            where: { tenantId, deletedAt: null, status: { not: 'DELETED' } },
            select: { sizeBytes: true, variants: true },
          });
          let storageBytes = 0;
          for (const row of mediaAssets) {
            storageBytes += Number(row.sizeBytes);
            const variants = (row.variants as Array<{ sizeBytes?: number }>) ?? [];
            for (const variant of variants) storageBytes += variant.sizeBytes ?? 0;
          }
          // Exact decimal string: bytes / 1GiB without float authority for enforcement compare via string decimal.
          const gb = storageBytes / (1024 * 1024 * 1024);
          return { ok: true, value: gb.toFixed(6).replace(/\.?0+$/, '') || '0' };
        }
        case 'meter.max_email_per_month':
        case 'meter.max_sms_per_month':
        case 'meter.max_whatsapp_per_month':
        case 'meter.max_push_per_month': {
          const period = this.periods.resolve('CALENDAR_MONTH', at);
          const channel =
            meterKey === 'meter.max_email_per_month'
              ? 'EMAIL'
              : meterKey === 'meter.max_sms_per_month'
                ? 'SMS'
                : meterKey === 'meter.max_whatsapp_per_month'
                  ? 'WHATSAPP'
                  : 'PUSH';
          const n = await this.prisma.communicationDispatchLedger.count({
            where: { tenantId, channel, usageMonth: period.usageMonth! },
          });
          return { ok: true, value: String(n) };
        }
        default:
          return { ok: false, code: 'meter_unsupported', message: `No aggregate reader for ${meterKey}` };
      }
    } catch (err) {
      return {
        ok: false,
        code: 'SOURCE_UNAVAILABLE',
        message: err instanceof Error ? err.message : 'aggregate_reader_failed',
      };
    }
  }

  /** Exact integer/decimal compare helpers (no JS float authority for integers). */
  static compareNumeric(a: string, b: string, valueType: 'integer' | 'decimal'): number {
    if (valueType === 'integer') {
      const ai = BigInt(a);
      const bi = BigInt(b);
      return ai === bi ? 0 : ai > bi ? 1 : -1;
    }
    const ad = Number(a);
    const bd = Number(b);
    if (!Number.isFinite(ad) || !Number.isFinite(bd)) {
      throw new UsageMeteringError('value_invalid', 'Non-finite decimal usage value');
    }
    return ad === bd ? 0 : ad > bd ? 1 : -1;
  }

  static addNumeric(a: string, b: string, valueType: 'integer' | 'decimal'): string {
    if (valueType === 'integer') return String(BigInt(a) + BigInt(b));
    return (Number(a) + Number(b)).toFixed(6).replace(/\.?0+$/, '') || '0';
  }

  static subNumeric(a: string, b: string, valueType: 'integer' | 'decimal'): string {
    if (valueType === 'integer') return String(BigInt(a) - BigInt(b));
    return (Number(a) - Number(b)).toFixed(6).replace(/\.?0+$/, '') || '0';
  }
}
