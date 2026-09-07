#!/usr/bin/env node
/**
 * Phase 48 Wave C — clinical-forms + inventory usage permission-route validation across 3 matrices.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

export const PATHS = {
  packages: path.join(repoRoot, 'packages/permissions/permission-matrix.json'),
  apiConfig: path.join(repoRoot, 'apps/api/config/permission-matrix.json'),
  docs: path.join(repoRoot, 'docs/permission-matrix.json'),
};

export const CLINICAL_FORMS_SIGN_VOID_ROLES = ['doctor', 'dentist', 'specialist', 'nurse'];

export const CLINICAL_FORMS_SIGN_VOID_FORBIDDEN_ROLES = [
  'super_admin',
  'owner',
  'general_manager',
  'branch_manager',
  'assistant',
  'receptionist',
  'accountant',
  'inventory_manager',
  'lab_technician',
  'radiologist',
  'cashier',
  'patient',
];

export const CLINICAL_FORMS_OPS = [
  ['GET', '/clinical-forms/templates', 'view'],
  ['POST', '/clinical-forms/templates', 'manage'],
  ['GET', '/clinical-forms/templates/:id', 'view'],
  ['POST', '/clinical-forms/templates/:id/activate', 'manage'],
  ['POST', '/clinical-forms/templates/:templateId/versions', 'manage'],
  ['POST', '/clinical-forms/versions/:id/publish', 'manage'],
  ['POST', '/clinical-forms/instances', 'create'],
  ['POST', '/clinical-forms/instances/:id/sign', 'approve'],
  ['POST', '/clinical-forms/instances/:id/void', 'approve'],
  ['GET', '/clinical-forms/requirements', 'view'],
  ['PUT', '/clinical-forms/requirements', 'manage'],
  ['POST', '/clinical-forms/requirements/:id/deactivate', 'manage'],
];

export const INVENTORY_USAGE_OPS = [
  ['POST', '/inventory/usage', 'update'],
  ['POST', '/inventory/usage/:id/reverse', 'approve'],
  ['POST', '/inventory/usage/:id/correct', 'approve'],
  ['GET', '/inventory/usage', 'view'],
  ['GET', '/inventory/usage/owner-report', 'export'],
];

const CONTROLLER_ROUTE_MARKERS = [
  ["inventory.controller.ts", "@Post('usage')"],
  ["inventory.controller.ts", "@Post('usage/:id/reverse')"],
  ["inventory.controller.ts", "@Post('usage/:id/correct')"],
  ["inventory.controller.ts", "@Get('usage/owner-report')"],
  ["inventory.controller.ts", "@Get('usage/:id/injectable')"],
  ["clinical-forms.controller.ts", "@Post('instances/:id/void')"],
  ["clinical-forms.controller.ts", "@Post('instances/:id/sign')"],
  ["clinical-forms.controller.ts", "@Put('requirements')"],
];

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(errors) {
  console.error('Wave C permission-route validation failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

export function findResource(matrix, id) {
  return (matrix.resources || []).find((r) => r.id === id);
}

export function hasOp(resource, method, pathName, action) {
  return (resource.operations || []).some(
    (op) => op.method === method && op.path === pathName && op.action === action,
  );
}

export function waveCOpsFingerprint(matrix) {
  const forms = findResource(matrix, 'api.clinical-forms');
  const inventory = findResource(matrix, 'api.inventory');
  const injectable = findResource(matrix, 'api.clinical-injectable');
  const pick = (resource, ops) =>
    ops.map(([method, pathName, action]) =>
      hasOp(resource, method, pathName, action) ? `${method} ${pathName} ${action}` : `MISSING ${method} ${pathName}`,
    );
  return JSON.stringify({
    forms: forms ? pick(forms, CLINICAL_FORMS_OPS) : ['MISSING_RESOURCE'],
    inventory: inventory ? pick(inventory, INVENTORY_USAGE_OPS) : ['MISSING_RESOURCE'],
    injectableCreateOnUsage: injectable
      ? hasOp(injectable, 'POST', '/inventory/usage', 'create')
      : false,
    clinicalFormsApproveRoles: [...((forms?.permissions?.approve) ?? [])].sort(),
  });
}

export function collectWaveCPermissionErrors(opts = {}) {
  const errors = [];
  const paths = opts.paths ?? PATHS;
  const matrices = Object.fromEntries(
    Object.entries(paths).map(([k, p]) => {
      if (!fs.existsSync(p)) {
        errors.push(`Missing matrix file: ${p}`);
        return [k, null];
      }
      return [k, load(p)];
    }),
  );
  if (errors.length) return errors;

  const fingerprints = [];
  for (const [label, matrix] of Object.entries(matrices)) {
    const forms = findResource(matrix, 'api.clinical-forms');
    if (!forms) {
      errors.push(`${label}: missing api.clinical-forms`);
    } else {
      for (const [method, pathName, action] of CLINICAL_FORMS_OPS) {
        if (!hasOp(forms, method, pathName, action)) {
          errors.push(`${label}: missing ${method} ${pathName} action=${action}`);
        }
      }
      const expectedRoles = [...CLINICAL_FORMS_SIGN_VOID_ROLES].sort();
      const actualRoles = [...(forms.permissions?.approve ?? [])].sort();
      if (JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles)) {
        errors.push(
          `${label}: api.clinical-forms approve role set must be exactly [${expectedRoles.join(', ')}] (frozen clinical staff for sign/void); got [${actualRoles.join(', ')}]`,
        );
      }
      for (const forbidden of CLINICAL_FORMS_SIGN_VOID_FORBIDDEN_ROLES) {
        if (actualRoles.includes(forbidden)) {
          errors.push(
            `${label}: api.clinical-forms approve must not include forbidden role ${forbidden} for PatientFormInstance sign/void`,
          );
        }
      }
    }

    const injectable = findResource(matrix, 'api.clinical-injectable');
    if (!injectable) {
      errors.push(`${label}: missing api.clinical-injectable`);
    } else if (!hasOp(injectable, 'POST', '/inventory/usage', 'create')) {
      errors.push(
        `${label}: missing conditional injectable contract POST /inventory/usage action=create on api.clinical-injectable`,
      );
    }

    const inventory = findResource(matrix, 'api.inventory');
    if (!inventory) {
      errors.push(`${label}: missing api.inventory`);
    } else {
      for (const [method, pathName, action] of INVENTORY_USAGE_OPS) {
        if (!hasOp(inventory, method, pathName, action)) {
          errors.push(`${label}: missing ${method} ${pathName} action=${action}`);
        }
      }
    }

    fingerprints.push(waveCOpsFingerprint(matrix));
  }

  if (fingerprints.length && fingerprints.some((fp) => fp !== fingerprints[0])) {
    errors.push('Wave C operations are not synchronized across authoritative permission matrices');
  }

  const controllerRoots = opts.controllerRoots ?? [
    path.join(repoRoot, 'apps/api/src/modules/inventory/controllers'),
    path.join(repoRoot, 'apps/api/src/modules/clinical-forms/api'),
  ];
  for (const [fileName, marker] of CONTROLLER_ROUTE_MARKERS) {
    let found = false;
    for (const root of controllerRoots) {
      const full = path.join(root, fileName);
      if (fs.existsSync(full) && fs.readFileSync(full, 'utf8').includes(marker)) {
        found = true;
        break;
      }
    }
    if (!found) errors.push(`controller missing route marker ${fileName} :: ${marker}`);
  }

  const guardPath = path.join(
    repoRoot,
    'apps/api/src/modules/auth/api/guards/permission.guard.ts',
  );
  if (fs.existsSync(guardPath)) {
    const guardSrc = fs.readFileSync(guardPath, 'utf8');
    if (!guardSrc.includes('CUSTOM_ROLE_GRANT_EXCLUSIONS')) {
      errors.push('permission.guard.ts missing CUSTOM_ROLE_GRANT_EXCLUSIONS for clinical-forms approve');
    }
    if (!guardSrc.includes("resource: 'api.clinical-forms', action: 'approve'")) {
      errors.push('permission.guard.ts must exclude api.clinical-forms / approve from custom grants');
    }
    if (!guardSrc.includes('customRoleGrantsApply')) {
      errors.push('permission.guard.ts must skip custom-role grants for protected clinical approve');
    }
  } else {
    errors.push('permission.guard.ts missing');
  }

  const sharedHelper = path.join(repoRoot, 'packages/permissions/src/index.ts');
  if (fs.existsSync(sharedHelper)) {
    const helperSrc = fs.readFileSync(sharedHelper, 'utf8');
    if (!helperSrc.includes('isProtectedPermission')) {
      errors.push('packages/permissions hasPermission helper missing isProtectedPermission');
    }
    if (!helperSrc.includes("resourceId: 'api.clinical-forms', action: 'approve'")) {
      errors.push('packages/permissions must protect api.clinical-forms / approve from custom grants');
    }
    if (!helperSrc.includes('if (isProtectedPermission(resourceId, action)) return false')) {
      errors.push('hasPermissionWithCustomGrants must ignore custom grants for protected approve');
    }
  } else {
    errors.push('packages/permissions/src/index.ts missing');
  }

  return errors;
}

function main() {
  const errors = collectWaveCPermissionErrors();
  if (errors.length) fail(errors);
  console.log('PHASE48_WAVE_C_PERMISSION_ROUTES_VALIDATOR_PASSED');
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
