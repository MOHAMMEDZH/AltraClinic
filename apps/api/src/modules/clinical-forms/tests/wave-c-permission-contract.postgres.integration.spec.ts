import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const apiRoot = path.resolve(__dirname, '../../../..');
const repoRoot = path.resolve(apiRoot, '../..');
const validatorModule = pathToFileURL(
  path.join(apiRoot, 'scripts/validate-phase48-wave-c-permission-routes.mjs'),
).href;

const MATRIX_PATHS = [
  path.join(repoRoot, 'packages/permissions/permission-matrix.json'),
  path.join(apiRoot, 'config/permission-matrix.json'),
  path.join(repoRoot, 'docs/permission-matrix.json'),
];

const CLINICAL_FORMS_OPS: Array<[string, string, string]> = [
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

type Matrix = {
  resources: Array<{
    id: string;
    permissions?: Record<string, string[]>;
    operations?: Array<{ method: string; path: string; action: string }>;
  }>;
};

function load(p: string): Matrix {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Matrix;
}

function findResource(matrix: Matrix, id: string) {
  return (matrix.resources || []).find((r) => r.id === id);
}

function hasOp(
  resource: Matrix['resources'][number] | undefined,
  method: string,
  pathName: string,
  action: string,
) {
  return (resource?.operations || []).some(
    (op) => op.method === method && op.path === pathName && op.action === action,
  );
}

const INVENTORY_USAGE_OPS: Array<[string, string, string]> = [
  ['POST', '/inventory/usage', 'update'],
  ['POST', '/inventory/usage/:id/reverse', 'approve'],
  ['POST', '/inventory/usage/:id/correct', 'approve'],
  ['GET', '/inventory/usage', 'view'],
  ['GET', '/inventory/usage/owner-report', 'export'],
];

function waveCOpsFingerprint(matrix: Matrix) {
  const forms = findResource(matrix, 'api.clinical-forms');
  const inventory = findResource(matrix, 'api.inventory');
  const injectable = findResource(matrix, 'api.clinical-injectable');
  const pick = (resource: Matrix['resources'][number] | undefined, ops: Array<[string, string, string]>) =>
    ops.map(([method, pathName, action]) =>
      hasOp(resource, method, pathName, action)
        ? `${method} ${pathName} ${action}`
        : `MISSING ${method} ${pathName}`,
    );
  return JSON.stringify({
    forms: forms ? pick(forms, CLINICAL_FORMS_OPS) : ['MISSING_RESOURCE'],
    inventory: inventory ? pick(inventory, INVENTORY_USAGE_OPS) : ['MISSING_RESOURCE'],
    injectableCreateOnUsage: injectable
      ? hasOp(injectable, 'POST', '/inventory/usage', 'create')
      : false,
  });
}

function collectWaveCPermissionErrors(opts: { paths?: Record<string, string> } = {}): string[] {
  const payload = JSON.stringify(opts);
  const script = `
import(${JSON.stringify(validatorModule)}).then((mod) => {
  const errors = mod.collectWaveCPermissionErrors(${payload});
  process.stdout.write(JSON.stringify(errors));
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: apiRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out.trim()) as string[];
}

describe('Wave C permission contract (matrices + full validator)', () => {
  const matrices = MATRIX_PATHS.map((p) => ({ path: p, matrix: load(p) }));

  it('valid authoritative matrices pass the full validator', () => {
    const errors = collectWaveCPermissionErrors({
      paths: {
        packages: MATRIX_PATHS[0],
        apiConfig: MATRIX_PATHS[1],
        docs: MATRIX_PATHS[2],
      },
    });
    expect(errors).toEqual([]);
  });

  it('sign/void approve role set is frozen clinical staff only', () => {
    const expected = ['dentist', 'doctor', 'nurse', 'specialist'];
    for (const { path: p, matrix } of matrices) {
      const forms = findResource(matrix, 'api.clinical-forms');
      const actual = [...(forms?.permissions?.approve ?? [])].sort();
      expect(actual).toEqual(expected);
      if (actual.includes('owner') || actual.includes('receptionist') || actual.includes('super_admin')) {
        throw new Error(`forbidden sign/void role present in ${p}`);
      }
    }
  });

  it('full validator fails when a forbidden role is added to sign/void approve', () => {
    const clone = structuredClone(matrices[0].matrix);
    const forms = findResource(clone, 'api.clinical-forms');
    forms!.permissions = {
      ...(forms!.permissions ?? {}),
      approve: [...(forms!.permissions?.approve ?? []), 'receptionist'],
    };
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-role-receptionist.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('receptionist') || e.includes('approve role set'))).toBe(
        true,
      );
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('full validator fails when owner is added to sign/void approve', () => {
    const clone = structuredClone(matrices[0].matrix);
    const forms = findResource(clone, 'api.clinical-forms');
    forms!.permissions = {
      ...(forms!.permissions ?? {}),
      approve: [...(forms!.permissions?.approve ?? []), 'owner'],
    };
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-role-owner.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('owner') || e.includes('approve role set'))).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('full validator fails when a required clinical role is removed from approve', () => {
    const clone = structuredClone(matrices[0].matrix);
    const forms = findResource(clone, 'api.clinical-forms');
    forms!.permissions = {
      ...(forms!.permissions ?? {}),
      approve: (forms!.permissions?.approve ?? []).filter((r) => r !== 'doctor'),
    };
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-role-missing-doctor.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('approve role set') || e.includes('doctor'))).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('sign/void routes use approve action in every matrix', () => {
    for (const { path: p, matrix } of matrices) {
      const forms = findResource(matrix, 'api.clinical-forms');
      expect(hasOp(forms, 'POST', '/clinical-forms/instances/:id/sign', 'approve')).toBe(true);
      expect(hasOp(forms, 'POST', '/clinical-forms/instances/:id/void', 'approve')).toBe(true);
      if (!hasOp(forms, 'POST', '/clinical-forms/instances/:id/void', 'approve')) {
        throw new Error(`missing void approve in ${p}`);
      }
    }
  });

  it('authoritative matrices are synchronized for Wave C ops', () => {
    const fingerprints = matrices.map(({ matrix }) => waveCOpsFingerprint(matrix));
    expect(new Set(fingerprints).size).toBe(1);
  });

  it('full validator fails when VOID is removed from a matrix copy', () => {
    const clone = structuredClone(matrices[0].matrix);
    const forms = findResource(clone, 'api.clinical-forms');
    forms!.operations = (forms!.operations ?? []).filter(
      (op) => op.path !== '/clinical-forms/instances/:id/void',
    );
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-void.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('void') || e.includes('instances/:id/void'))).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('full validator fails when sign uses wrong action in a matrix copy', () => {
    const clone = structuredClone(matrices[0].matrix);
    const forms = findResource(clone, 'api.clinical-forms');
    for (const op of forms!.operations ?? []) {
      if (op.path === '/clinical-forms/instances/:id/sign') op.action = 'view';
    }
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-sign.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('sign') && e.includes('approve'))).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('full validator fails when injectable conditional create op is missing', () => {
    const clone = structuredClone(matrices[0].matrix);
    const injectable = findResource(clone, 'api.clinical-injectable');
    injectable!.operations = (injectable!.operations ?? []).filter(
      (op) => !(op.method === 'POST' && op.path === '/inventory/usage' && op.action === 'create'),
    );
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-negative-inj.json');
    fs.writeFileSync(tmp, JSON.stringify(clone));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: { negative: tmp, packages: matrices[0].path, apiConfig: matrices[1].path },
      });
      expect(errors.some((e) => e.includes('injectable') || e.includes('/inventory/usage'))).toBe(
        true,
      );
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('full validator fails when one matrix copy is desynchronized', () => {
    const desync = structuredClone(matrices[0].matrix);
    const forms = findResource(desync, 'api.clinical-forms');
    forms!.operations = (forms!.operations ?? []).filter(
      (op) => op.path !== '/clinical-forms/instances/:id/void',
    );
    const tmp = path.join(apiRoot, 'tmp-wave-c-perm-desync.json');
    fs.writeFileSync(tmp, JSON.stringify(desync));
    try {
      const errors = collectWaveCPermissionErrors({
        paths: {
          packages: matrices[0].path,
          apiConfig: tmp,
          docs: matrices[2].path,
        },
      });
      expect(errors.some((e) => e.includes('not synchronized'))).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('CLINICAL_FORMS_OPS contract includes sign/void approve actions', () => {
    expect(CLINICAL_FORMS_OPS).toContainEqual([
      'POST',
      '/clinical-forms/instances/:id/sign',
      'approve',
    ]);
    expect(CLINICAL_FORMS_OPS).toContainEqual([
      'POST',
      '/clinical-forms/instances/:id/void',
      'approve',
    ]);
  });

  it('full validator requires custom-role exclusion for clinical-forms approve', () => {
    const errors = collectWaveCPermissionErrors({
      paths: {
        packages: MATRIX_PATHS[0],
        apiConfig: MATRIX_PATHS[1],
        docs: MATRIX_PATHS[2],
      },
    });
    expect(errors.filter((e) => e.includes('CUSTOM_ROLE') || e.includes('custom-role') || e.includes('isProtectedPermission'))).toEqual([]);
    const guardSrc = fs.readFileSync(
      path.join(apiRoot, 'src/modules/auth/api/guards/permission.guard.ts'),
      'utf8',
    );
    expect(guardSrc).toContain('CUSTOM_ROLE_GRANT_EXCLUSIONS');
    expect(guardSrc).toContain('customRoleGrantsApply');
    const helperSrc = fs.readFileSync(
      path.join(repoRoot, 'packages/permissions/src/index.ts'),
      'utf8',
    );
    expect(helperSrc).toContain('isProtectedPermission');
    expect(helperSrc).toContain("if (isProtectedPermission(resourceId, action)) return false");
  });
});
