import { describe, expect, it } from 'vitest';
import { buildAllAnalyticsContributions } from '../analytics/build-analytics-contributions';

describe('analytics widget duplicate detection (Phase 34a M2)', () => {
  it('manifest contributions have globally unique widgetCatalogId values', () => {
    const contributions = buildAllAnalyticsContributions().filter((entry) => entry.analyticsKind === 'widget');
    const ids = contributions.map((entry) => entry.widgetCatalogId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('manifest contributions have globally unique extensionId values', () => {
    const contributions = buildAllAnalyticsContributions();
    const ids = contributions.map((entry) => entry.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('manifest widget deep links are globally unique', () => {
    const contributions = buildAllAnalyticsContributions().filter((entry) => entry.analyticsKind === 'widget');
    const links = contributions.map((entry) => entry.deepLinkTemplate);
    expect(new Set(links).size).toBe(links.length);
  });

  it('manifest domain and hub routes are globally unique', () => {
    const contributions = buildAllAnalyticsContributions().filter(
      (entry) => entry.analyticsKind === 'domain' || entry.analyticsKind === 'hub',
    );
    const routes = contributions.map((entry) => entry.route).filter(Boolean);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
