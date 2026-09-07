#!/usr/bin/env node
/**
 * Phase 48 Wave A — targeted permission-route validation.
 * Proves Wave A clinical-catalog / price routes are synchronized and structurally valid
 * without requiring the global matrix.actions list to include/exclude "manage"
 * (pre-existing baseline debt vs validate-permission-matrix.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const PATHS = {
  packages: path.join(repoRoot, 'packages/permissions/permission-matrix.json'),
  apiConfig: path.join(repoRoot, 'apps/api/config/permission-matrix.json'),
  docs: path.join(repoRoot, 'docs/permission-matrix.json'),
};

const WAVE_A_CLINICAL_OPS = [
  ['GET', '/clinical-catalog/services', 'view'],
  ['GET', '/clinical-catalog/services/:id', 'view'],
  ['POST', '/clinical-catalog/services', 'create'],
  ['PATCH', '/clinical-catalog/services/:id', 'update'],
  ['POST', '/clinical-catalog/services/:id/publish', 'manage'],
  ['POST', '/clinical-catalog/services/:id/deprecate', 'manage'],
  ['POST', '/clinical-catalog/services/:id/inactivate', 'manage'],
  ['GET', '/clinical-catalog/configs', 'view'],
  ['GET', '/clinical-catalog/configs/effective', 'view'],
  ['PUT', '/clinical-catalog/configs', 'update'],
  ['PATCH', '/clinical-catalog/configs/:id/enabled', 'manage'],
];

const WAVE_A_PRICE_OPS = [
  ['GET', '/clinical-catalog/prices', 'view'],
  ['GET', '/clinical-catalog/prices/lookup', 'view'],
  ['POST', '/clinical-catalog/prices/drafts', 'manage'],
  ['POST', '/clinical-catalog/prices/:id/publish', 'manage'],
  ['POST', '/clinical-catalog/prices/:id/inactivate', 'manage'],
  ['POST', '/clinical-catalog/prices/:id/replace-scheduled', 'manage'],
];

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(errors) {
  console.error('Wave A permission-route validation failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

function findResource(matrix, id) {
  return (matrix.resources || []).find((r) => r.id === id);
}

function hasOp(resource, method, pathName, action) {
  return (resource.operations || []).some(
    (op) => op.method === method && op.path === pathName && op.action === action,
  );
}

function main() {
  const errors = [];
  const matrices = Object.fromEntries(
    Object.entries(PATHS).map(([k, p]) => {
      if (!fs.existsSync(p)) {
        errors.push(`Missing matrix file: ${p}`);
        return [k, null];
      }
      return [k, load(p)];
    }),
  );
  if (errors.length) fail(errors);

  for (const [label, matrix] of Object.entries(matrices)) {
    const clinical = findResource(matrix, 'api.clinical-catalog');
    if (!clinical) {
      errors.push(`${label}: missing api.clinical-catalog`);
      continue;
    }
    for (const action of ['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']) {
      if (!Array.isArray(clinical.permissions?.[action])) {
        errors.push(`${label}: api.clinical-catalog missing permissions.${action}`);
      } else if (!clinical.permissions[action].includes('super_admin')) {
        errors.push(`${label}: api.clinical-catalog.${action} must include super_admin`);
      }
    }
    for (const [method, pathName, action] of WAVE_A_CLINICAL_OPS) {
      if (!hasOp(clinical, method, pathName, action)) {
        errors.push(`${label}: missing ${method} ${pathName} action=${action}`);
      }
    }

    const billing = findResource(matrix, 'api.billing');
    if (!billing) {
      errors.push(`${label}: missing api.billing`);
      continue;
    }
    for (const [method, pathName, action] of WAVE_A_PRICE_OPS) {
      if (!hasOp(billing, method, pathName, action)) {
        errors.push(`${label}: api.billing missing ${method} ${pathName} action=${action}`);
      }
    }
  }

  // Triple-file sync for Wave A resources
  const clinicalOps = (label) =>
    JSON.stringify(
      (findResource(matrices[label], 'api.clinical-catalog')?.operations || []).map((o) => [
        o.method,
        o.path,
        o.action,
      ]),
    );
  if (clinicalOps('packages') !== clinicalOps('apiConfig') || clinicalOps('packages') !== clinicalOps('docs')) {
    errors.push('api.clinical-catalog operations are not synchronized across packages/api/docs matrices');
  }

  const priceOps = (label) => {
    const billing = findResource(matrices[label], 'api.billing');
    return JSON.stringify(
      (billing?.operations || [])
        .filter((o) => String(o.path).startsWith('/clinical-catalog/prices'))
        .map((o) => [o.method, o.path, o.action]),
    );
  };
  if (priceOps('packages') !== priceOps('apiConfig') || priceOps('packages') !== priceOps('docs')) {
    errors.push('clinical price operations are not synchronized across packages/api/docs matrices');
  }

  if (errors.length) fail(errors);
  console.log('PHASE48_WAVE_A_PERMISSION_ROUTES_VALIDATOR_PASSED');
  console.log(
    `Validated Wave A clinical-catalog + price routes across ${Object.keys(PATHS).length} matrix files.`,
  );
}

main();
