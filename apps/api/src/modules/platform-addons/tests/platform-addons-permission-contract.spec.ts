/**
 * Step 15 Option A permission contract — unified addon.manage (no edit/publish/retire split).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PLATFORM_PERMISSIONS } from '../../auth/platform-rbac/platform-rbac.catalog';

describe('Step 15 Add-on permission contract (Option A)', () => {
  const servicePath = join(__dirname, '../application/platform-addons.service.ts');
  const catalogKeys = new Set(PLATFORM_PERMISSIONS.map((p) => p.key));

  it('catalog defines only addon.view and addon.manage (no addon.publish / addon.retire)', () => {
    expect(catalogKeys.has('addon.view')).toBe(true);
    expect(catalogKeys.has('addon.manage')).toBe(true);
    expect(catalogKeys.has('addon.publish')).toBe(false);
    expect(catalogKeys.has('addon.retire')).toBe(false);
  });

  it('service mutations require addon.manage including publish and retire', () => {
    const src = readFileSync(servicePath, 'utf8');
    // Every mutation path uses addon.manage; publish/retire are not separately gated.
    expect(src).toMatch(/this\.require\(permissions,\s*'addon\.manage'\)/);
    // No permission string literals for separate publish/retire permissions (Option A).
    expect(src).not.toMatch(/'addon\.publish'/);
    expect(src).not.toMatch(/'addon\.retire'/);
    expect(src).not.toMatch(/"addon\.publish"/);
    expect(src).not.toMatch(/"addon\.retire"/);
    // High-impact paths still require fresh step-up
    expect(src).toMatch(/requireFreshStepUp/);
    const publishIdx = src.indexOf('async publishVersion');
    const retireIdx = src.indexOf('async retireVersion');
    expect(publishIdx).toBeGreaterThan(0);
    expect(retireIdx).toBeGreaterThan(0);
    expect(src.slice(publishIdx, publishIdx + 800)).toMatch(/addon\.manage/);
    expect(src.slice(publishIdx, publishIdx + 800)).toMatch(/requireFreshStepUp/);
    expect(src.slice(retireIdx, retireIdx + 800)).toMatch(/addon\.manage/);
    expect(src.slice(retireIdx, retireIdx + 800)).toMatch(/requireFreshStepUp/);
  });

  it('documents that edit/publish/retire are not permission-isolated', () => {
    const docs = readFileSync(
      join(__dirname, '../../../../../../docs/SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md'),
      'utf8',
    );
    expect(docs).toMatch(/Option A/);
    expect(docs).toMatch(/no.*permission isolation between edit vs publish vs retire/i);
    expect(docs).toMatch(/fresh step-up/i);
  });
});
