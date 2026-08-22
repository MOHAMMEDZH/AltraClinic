#!/usr/bin/env node
/**
 * Phase 48 Wave F — permission-route validation across 3 matrices.
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

export const WAVE_F_OPS = {
  'api.staff-commission': [
    ['PATCH', '/workforce-commercials/users/:userId/commission-eligibility', 'update'],
    ['POST', '/workforce-commercials/plans', 'create'],
    ['POST', '/workforce-commercials/plans/:id/publish', 'update'],
    ['GET', '/workforce-commercials/plans', 'view'],
    ['GET', '/workforce-commercials/plans/:id', 'view'],
    ['POST', '/workforce-commercials/accruals/post', 'create'],
    ['POST', '/workforce-commercials/accruals/post-collected', 'create'],
    ['POST', '/workforce-commercials/accruals/:id/reverse', 'manage'],
    ['POST', '/workforce-commercials/accruals/:id/correct', 'manage'],
    ['POST', '/workforce-commercials/accruals/:id/settle', 'approve'],
    ['POST', '/workforce-commercials/invoice-lines/bind-performance', 'update'],
    ['POST', '/workforce-commercials/package-allocations', 'create'],
    ['GET', '/workforce-commercials/accruals/:id', 'view'],
    ['GET', '/workforce-commercials/owner-report', 'export'],
  ],
};

const CONTROLLER_ROUTE_MARKERS = [
  ['workforce-commercials.controller.ts', "@Controller('workforce-commercials')"],
  ['workforce-commercials.controller.ts', "@Patch('users/:userId/commission-eligibility')"],
  ['workforce-commercials.controller.ts', "@Post('plans')"],
  ['workforce-commercials.controller.ts', "@Post('plans/:id/publish')"],
  ['workforce-commercials.controller.ts', "@Get('plans')"],
  ['workforce-commercials.controller.ts', "@Get('plans/:id')"],
  ['workforce-commercials.controller.ts', "@Post('accruals/post')"],
  ['workforce-commercials.controller.ts', "@Post('accruals/post-collected')"],
  ['workforce-commercials.controller.ts', "@Post('accruals/:id/reverse')"],
  ['workforce-commercials.controller.ts', "@Post('accruals/:id/correct')"],
  ['workforce-commercials.controller.ts', "@Post('accruals/:id/settle')"],
  ['workforce-commercials.controller.ts', "@Post('invoice-lines/bind-performance')"],
  ['workforce-commercials.controller.ts', "@Post('package-allocations')"],
  ['workforce-commercials.controller.ts', "@Get('accruals/:id')"],
  ['workforce-commercials.controller.ts', "@Get('owner-report')"],
];

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findResource(matrix, id) {
  return (matrix.resources || []).find((r) => r.id === id);
}

function hasOp(resource, method, pathName, action) {
  return (resource.operations || []).some(
    (op) => op.method === method && op.path === pathName && op.action === action,
  );
}

function fingerprint(matrix) {
  const out = {};
  for (const [id, ops] of Object.entries(WAVE_F_OPS)) {
    const resource = findResource(matrix, id);
    out[id] = resource
      ? ops.map(([method, pathName, action]) =>
          hasOp(resource, method, pathName, action)
            ? `${method} ${pathName} ${action}`
            : `MISSING ${method} ${pathName}`,
        )
      : ['MISSING_RESOURCE'];
  }
  return JSON.stringify(out);
}

export function collectWaveFPermissionErrors() {
  const errors = [];
  const matrices = Object.fromEntries(Object.entries(PATHS).map(([k, p]) => [k, load(p)]));
  const fps = [];
  for (const [label, matrix] of Object.entries(matrices)) {
    for (const [id, ops] of Object.entries(WAVE_F_OPS)) {
      const resource = findResource(matrix, id);
      if (!resource) {
        errors.push(`${label}: missing ${id}`);
        continue;
      }
      for (const [method, pathName, action] of ops) {
        if (!hasOp(resource, method, pathName, action)) {
          errors.push(`${label}: missing ${method} ${pathName} action=${action}`);
        }
      }
    }
    fps.push(fingerprint(matrix));
  }
  if (new Set(fps).size !== 1) {
    errors.push('Wave F permission fingerprints differ across the three matrices');
  }
  const apiSrc = path.join(repoRoot, 'apps/api/src/modules');
  for (const [file, marker] of CONTROLLER_ROUTE_MARKERS) {
    const found = fs
      .readdirSync(apiSrc, { recursive: true })
      .some(
        (rel) =>
          String(rel).endsWith(file) &&
          fs.readFileSync(path.join(apiSrc, rel), 'utf8').includes(marker),
      );
    if (!found) errors.push(`Missing controller marker ${file} ${marker}`);
  }
  return errors;
}

if (
  process.argv[1] &&
  path.normalize(process.argv[1]).includes('validate-phase48-wave-f-permission-routes')
) {
  const errors = collectWaveFPermissionErrors();
  if (errors.length) {
    console.error('Wave F permission-route validation failed:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('Wave F permission-route validation PASS');
}
