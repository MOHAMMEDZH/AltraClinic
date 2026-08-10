import { Injectable } from '@nestjs/common';
import type { MetricSeriesSnapshot } from '../../domain/metrics.types';
import type { MetricsExportPort } from '../../application/ports/export.port';

/**
 * Phase 45b — in-process OpenMetrics-compatible text export (OD-EXPORT).
 * Not a commercial APM SoR.
 */
@Injectable()
export class InProcessMetricsExport implements MetricsExportPort {
  readonly contractVersion = '45b' as const;
  readonly providerKind = 'in_platform' as const;
  readonly reservedPath = '/metrics' as const;

  renderText(series: readonly MetricSeriesSnapshot[]): string {
    const lines: string[] = [];
    const byName = new Map<string, MetricSeriesSnapshot[]>();
    for (const s of series) {
      const list = byName.get(s.name) ?? [];
      list.push(s);
      byName.set(s.name, list);
    }

    for (const [name, items] of byName) {
      const first = items[0]!;
      const promName = name.replace(/\./g, '_');
      lines.push(`# HELP ${promName} ${escapeHelp(first.name)}`);
      lines.push(`# TYPE ${promName} ${toPromType(first.type)}`);

      for (const item of items) {
        const labelStr = formatLabels(item.labels);
        if (item.state.type === 'counter' || item.state.type === 'gauge') {
          lines.push(`${promName}${labelStr} ${item.state.value}`);
        } else if (item.state.type === 'histogram') {
          let cumulative = 0;
          for (let i = 0; i < item.state.bounds.length; i++) {
            cumulative += item.state.counts[i] ?? 0;
            const leLabels = formatLabels({
              ...item.labels,
              le: String(item.state.bounds[i]),
            });
            lines.push(`${promName}_bucket${leLabels} ${cumulative}`);
          }
          cumulative += item.state.counts[item.state.bounds.length] ?? 0;
          const infLabels = formatLabels({ ...item.labels, le: '+Inf' });
          lines.push(`${promName}_bucket${infLabels} ${cumulative}`);
          lines.push(`${promName}_sum${labelStr} ${item.state.sum}`);
          lines.push(`${promName}_count${labelStr} ${item.state.count}`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push('# Observability Center metrics export (empty)');
    }
    return `${lines.join('\n')}\n`;
  }

  async flush(): Promise<{ ok: boolean }> {
    // In-process scrape model — no remote push in 45b.
    return { ok: true };
  }
}

function toPromType(type: MetricSeriesSnapshot['type']): string {
  if (type === 'counter') return 'counter';
  if (type === 'gauge') return 'gauge';
  return 'histogram';
}

function formatLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  const inner = keys
    .map((k) => `${k}="${escapeLabel(labels[k]!)}"`)
    .join(',');
  return `{${inner}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function escapeHelp(value: string): string {
  return value.replace(/\n/g, ' ');
}
