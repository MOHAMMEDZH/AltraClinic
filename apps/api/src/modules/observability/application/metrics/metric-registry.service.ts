import { Injectable } from '@nestjs/common';
import { BUILTIN_METRIC_DESCRIPTORS } from '../../domain/metric-descriptors';
import type { MetricDescriptor } from '../../domain/metrics.types';
import { METRIC_GLOBAL_LABEL_ALLOWLIST } from '../../domain/metrics.types';

export type MetricRegistrationResult =
  | { ok: true; descriptor: MetricDescriptor }
  | { ok: false; reason: string };

const NAME_PATTERN = /^[a-z][a-z0-9_.]{2,127}$/;

/**
 * Phase 45b — metric registry with validation (OD-METRICS).
 */
@Injectable()
export class MetricRegistryService {
  private readonly byName = new Map<string, MetricDescriptor>();

  constructor() {
    for (const d of BUILTIN_METRIC_DESCRIPTORS) {
      this.byName.set(d.name, Object.freeze({ ...d, allowedLabels: [...d.allowedLabels] }));
    }
  }

  list(): readonly MetricDescriptor[] {
    return [...this.byName.values()];
  }

  get(name: string): MetricDescriptor | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  register(descriptor: MetricDescriptor): MetricRegistrationResult {
    const validation = this.validateDescriptor(descriptor);
    if (!validation.ok) return validation;

    if (this.byName.has(descriptor.name)) {
      return { ok: false, reason: `duplicate metric: ${descriptor.name}` };
    }

    const frozen: MetricDescriptor = Object.freeze({
      ...descriptor,
      allowedLabels: Object.freeze([...descriptor.allowedLabels]),
      histogramBounds: descriptor.histogramBounds
        ? Object.freeze([...descriptor.histogramBounds])
        : undefined,
    });
    this.byName.set(frozen.name, frozen);
    return { ok: true, descriptor: frozen };
  }

  validateDescriptor(
    descriptor: MetricDescriptor,
  ): MetricRegistrationResult {
    if (!NAME_PATTERN.test(descriptor.name)) {
      return { ok: false, reason: 'invalid metric name' };
    }
    if (!descriptor.description?.trim()) {
      return { ok: false, reason: 'description required' };
    }
    if (!['counter', 'gauge', 'histogram'].includes(descriptor.type)) {
      return { ok: false, reason: 'invalid metric type' };
    }
    if (!descriptor.unit) {
      return { ok: false, reason: 'unit required' };
    }
    if (!Number.isFinite(descriptor.maxSeries) || descriptor.maxSeries < 1) {
      return { ok: false, reason: 'maxSeries must be >= 1' };
    }
    if (
      !Number.isFinite(descriptor.retentionDays) ||
      descriptor.retentionDays < 1
    ) {
      return { ok: false, reason: 'retentionDays must be >= 1' };
    }
    const global = new Set<string>(METRIC_GLOBAL_LABEL_ALLOWLIST);
    for (const label of descriptor.allowedLabels) {
      if (!global.has(label)) {
        return { ok: false, reason: `label not in global allowlist: ${label}` };
      }
    }
    if (descriptor.type === 'histogram') {
      const bounds = descriptor.histogramBounds;
      if (!bounds || bounds.length === 0) {
        return { ok: false, reason: 'histogramBounds required for histogram' };
      }
      for (let i = 1; i < bounds.length; i++) {
        if (!(bounds[i]! > bounds[i - 1]!)) {
          return { ok: false, reason: 'histogramBounds must be strictly increasing' };
        }
      }
    }
    if (
      descriptor.sampleRatio != null &&
      (descriptor.sampleRatio < 0 || descriptor.sampleRatio > 1)
    ) {
      return { ok: false, reason: 'sampleRatio must be 0..1' };
    }
    if (
      descriptor.scope === 'platform' &&
      descriptor.allowedLabels.includes('tenant_id')
    ) {
      return {
        ok: false,
        reason: 'platform metrics must not allow tenant_id label',
      };
    }
    return { ok: true, descriptor };
  }
}
