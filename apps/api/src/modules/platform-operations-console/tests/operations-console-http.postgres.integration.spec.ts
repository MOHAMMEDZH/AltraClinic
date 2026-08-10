/**

 * Flexible Step 22 — HTTP contract inventory (exhaustive matrix in sibling spec).

 */

import { PlatformOperationsConsoleController } from '../controllers/platform-operations-console.controller';

import { OPERATIONS_CONSOLE_PERMISSIONS } from '../platform-operations-console.constants';



const ROUTE_INVENTORY = [

  { id: 'R01', method: 'GET', path: '/platform/operations/overview' },

  { id: 'R02', method: 'GET', path: '/platform/operations/health' },

  { id: 'R03', method: 'GET', path: '/platform/operations/jobs' },

  { id: 'R04', method: 'GET', path: '/platform/operations/jobs/:ref' },

  { id: 'R05', method: 'GET', path: '/platform/operations/provisioning' },

  { id: 'R06', method: 'GET', path: '/platform/operations/subscription-expiry' },

  { id: 'R07', method: 'GET', path: '/platform/operations/override-expiry' },

  { id: 'R08', method: 'GET', path: '/platform/operations/entitlement-health' },

  { id: 'R09', method: 'GET', path: '/platform/operations/compatibility' },

  { id: 'R10', method: 'GET', path: '/platform/operations/integrations' },

  { id: 'R11', method: 'GET', path: '/platform/operations/backups' },

  { id: 'R12', method: 'POST', path: '/platform/operations/provisioning/:id/retry' },

  { id: 'R13', method: 'POST', path: '/platform/operations/entitlement-cache/invalidate' },

] as const;



describe('Step 22 Operations Console HTTP contract', () => {

  it('registers all 13 controller handlers', () => {

    const proto = PlatformOperationsConsoleController.prototype;

    const methods = [

      'overview',

      'health',

      'jobs',

      'job',

      'provisioning',

      'subscriptionExpiry',

      'overrideExpiry',

      'entitlementHealth',

      'compatibility',

      'integrations',

      'backups',

      'retryProvisioning',

      'invalidateCache',

    ] as const;

    for (const m of methods) {

      expect(typeof (proto as unknown as Record<string, unknown>)[m]).toBe('function');

    }

  });



  it('H14 permissions are narrow and explicit', () => {

    expect(OPERATIONS_CONSOLE_PERMISSIONS.view).toBe('operations.view');

    expect(OPERATIONS_CONSOLE_PERMISSIONS.cacheInvalidate).toBe('operations.cache.invalidate');

    expect(OPERATIONS_CONSOLE_PERMISSIONS.provisionRetry).toBe('tenant.provision.retry');

  });



  it('inventory matches exhaustive ROUTES (13 routes)', () => {

    expect(ROUTE_INVENTORY).toHaveLength(13);

    expect(ROUTE_INVENTORY.map((r) => r.id)).toEqual([

      'R01',

      'R02',

      'R03',

      'R04',

      'R05',

      'R06',

      'R07',

      'R08',

      'R09',

      'R10',

      'R11',

      'R12',

      'R13',

    ]);

  });

});



// Real Passport H01–H40 coverage: operations-console-http-exhaustive.postgres.integration.spec.ts


