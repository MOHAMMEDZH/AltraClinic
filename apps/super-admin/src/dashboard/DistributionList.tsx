import { useI18n } from '@booking/i18n/react';
import type { MetricBreakdown } from './types';

interface DistributionListProps {
  breakdown: MetricBreakdown[];
  captionKey?: string;
  /** Fallback caption text when captionKey is absent. */
  caption?: string;
}

/**
 * Renders a metric breakdown as accessible CSS bars — NO chart library.
 * Each row shows a text label + numeric count; the bar is decorative width
 * only, so the data is fully legible without color or width perception.
 */
export function DistributionList({ breakdown, captionKey, caption }: DistributionListProps) {
  const { t } = useI18n();
  const max = breakdown.reduce((acc, item) => Math.max(acc, item.count), 0);

  return (
    <table className="sa-distribution" role="table">
      <caption className="sa-visually-hidden">
        {captionKey ? t(captionKey, caption ?? '') : caption ?? ''}
      </caption>
      <tbody>
        {breakdown.map((item) => {
          const pct = max > 0 ? Math.round((item.count / max) * 100) : 0;
          return (
            <tr key={item.key} className="sa-distribution-row">
              <th scope="row" className="sa-distribution-label">
                {t(item.labelKey, item.key)}
              </th>
              <td className="sa-distribution-bar-cell">
                <span
                  className="sa-distribution-bar"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </td>
              <td className="sa-distribution-count">{item.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
