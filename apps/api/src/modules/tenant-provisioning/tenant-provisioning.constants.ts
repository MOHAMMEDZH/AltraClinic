export const TENANT_PROVISIONING_MODULE = 'tenant-provisioning';

export const ORG_NAME_MAX = 255;
export const SLUG_MAX = 100;
export const EMAIL_MAX = 320;
export const SPECIALTY_MAX = 32;
export const ADDON_SELECTION_MAX = 32;
export const TEXT_FIELD_MAX = 500;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PROHIBITED_REQUEST_KEYS = [
  'modules',
  'moduleKeys',
  'features',
  'featureKeys',
  'limits',
  'limitValues',
  'overrides',
  'overrideIds',
  'snapshot',
  'entitlementSnapshot',
  'password',
  'secret',
  'token',
  'phi',
  'patient',
  'clinical',
] as const;

/** Narrow Step 17 Platform permissions (not general subscription.migrate). */
export const PROVISION_PERMISSIONS = {
  view: 'tenant.provision.view',
  create: 'tenant.provision.create',
  execute: 'tenant.provision.execute',
  retry: 'tenant.provision.retry',
  compensate: 'tenant.provision.compensate',
  activate: 'tenant.provision.activate',
} as const;
