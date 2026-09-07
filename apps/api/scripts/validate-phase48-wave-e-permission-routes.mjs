#!/usr/bin/env node
/**
 * Phase 48 Wave E — permission-route validation across 3 matrices.
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

export const WAVE_E_OPS = {
  'api.treatment-course': [
    ['POST', '/aesthetic/treatment-courses', 'create'],
    ['GET', '/aesthetic/treatment-courses/:id', 'view'],
    ['POST', '/aesthetic/treatment-courses/:id/transition', 'update'],
    [
      'POST',
      '/aesthetic/treatment-courses/:courseId/sessions/:sessionId/link-appointment',
      'update',
    ],
    [
      'POST',
      '/aesthetic/treatment-courses/:courseId/sessions/:sessionId/transition',
      'update',
    ],
  ],
  'api.device-treatment': [
    ['POST', '/aesthetic/device-treatments', 'create'],
    ['GET', '/aesthetic/device-treatments/:id', 'view'],
    ['POST', '/aesthetic/device-treatments/:id/corrections', 'manage'],
  ],
  'api.dermatology-encounter': [
    ['POST', '/aesthetic/dermatology/encounters', 'create'],
    ['GET', '/aesthetic/dermatology/encounters/:id', 'view'],
    ['POST', '/aesthetic/dermatology/encounters/:id/photos', 'update'],
    ['GET', '/aesthetic/dermatology/no-dermatology-record', 'view'],
  ],
  'api.pre-post-care': [
    ['GET', '/aesthetic/pre-post-care/kinds', 'view'],
    ['POST', '/aesthetic/pre-post-care/instances', 'create'],
    ['POST', '/aesthetic/pre-post-care/instances/:id/assert', 'view'],
  ],
};

const CONTROLLER_ROUTE_MARKERS = [
  ['aesthetic-wave-e.controller.ts', "@Post('treatment-courses')"],
  ['aesthetic-wave-e.controller.ts', "@Get('treatment-courses/:id')"],
  ['aesthetic-wave-e.controller.ts', "@Post('treatment-courses/:id/transition')"],
  [
    'aesthetic-wave-e.controller.ts',
    "@Post('treatment-courses/:courseId/sessions/:sessionId/link-appointment')",
  ],
  [
    'aesthetic-wave-e.controller.ts',
    "@Post('treatment-courses/:courseId/sessions/:sessionId/transition')",
  ],
  ['aesthetic-wave-e.controller.ts', "@Post('device-treatments')"],
  ['aesthetic-wave-e.controller.ts', "@Get('device-treatments/:id')"],
  ['aesthetic-wave-e.controller.ts', "@Post('device-treatments/:id/corrections')"],
  ['aesthetic-wave-e.controller.ts', "@Post('dermatology/encounters')"],
  ['aesthetic-wave-e.controller.ts', "@Get('dermatology/encounters/:id')"],
  ['aesthetic-wave-e.controller.ts', "@Post('dermatology/encounters/:id/photos')"],
  ['aesthetic-wave-e.controller.ts', "@Get('dermatology/no-dermatology-record')"],
  ['aesthetic-wave-e.controller.ts', "@Get('pre-post-care/kinds')"],
  ['aesthetic-wave-e.controller.ts', "@Post('pre-post-care/instances')"],
  ['aesthetic-wave-e.controller.ts', "@Post('pre-post-care/instances/:id/assert')"],
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
  for (const [id, ops] of Object.entries(WAVE_E_OPS)) {
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

export function collectWaveEPermissionErrors() {
  const errors = [];
  const matrices = Object.fromEntries(Object.entries(PATHS).map(([k, p]) => [k, load(p)]));
  const fps = [];
  for (const [label, matrix] of Object.entries(matrices)) {
    for (const [id, ops] of Object.entries(WAVE_E_OPS)) {
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
    errors.push('Wave E permission fingerprints differ across the three matrices');
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
  path.normalize(process.argv[1]).includes('validate-phase48-wave-e-permission-routes')
) {
  const errors = collectWaveEPermissionErrors();
  if (errors.length) {
    console.error('Wave E permission-route validation failed:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('Wave E permission-route validation PASS');
}
