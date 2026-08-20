#!/usr/bin/env node
/**
 * Phase 48 Wave D — permission-route validation across 3 matrices.
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

export const WAVE_D_OPS = {
  'api.treatment-plan-links': [
    ['GET', '/dental/treatment-plans/:planId/items/:itemId/appointments', 'view'],
    ['POST', '/dental/treatment-plans/:planId/items/:itemId/appointments', 'create'],
    ['DELETE', '/dental/treatment-plans/:planId/items/:itemId/appointments/:appointmentId', 'delete'],
    ['POST', '/dental/treatment-plans/:planId/items/:itemId/complete-from-appointment', 'update'],
  ],
  'api.dental-lab': [
    ['GET', '/dental/lab-cases', 'view'],
    ['GET', '/dental/lab-cases/:id', 'view'],
    ['POST', '/dental/lab-cases', 'create'],
    ['POST', '/dental/lab-cases/:id/transition', 'update'],
    ['POST', '/dental/lab-cases/:id/attachments', 'update'],
  ],
  'api.service-performance': [
    ['POST', '/service-performances', 'create'],
    ['GET', '/service-performances/:id', 'view'],
    ['POST', '/service-performances/:id/complete', 'approve'],
    ['POST', '/service-performances/:id/corrections', 'manage'],
  ],
};

const CONTROLLER_ROUTE_MARKERS = [
  ['treatment-plan-links.controller.ts', "@Post(':planId/items/:itemId/appointments')"],
  ['treatment-plan-links.controller.ts', "@Post(':planId/items/:itemId/complete-from-appointment')"],
  ['dental-lab-cases.controller.ts', "@Post(':id/transition')"],
  ['service-performance.controller.ts', "@Post(':id/complete')"],
  ['schedule-settings.controller.ts', "@Post('resources')"],
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
  for (const [id, ops] of Object.entries(WAVE_D_OPS)) {
    const resource = findResource(matrix, id);
    out[id] = resource
      ? ops.map(([method, pathName, action]) =>
          hasOp(resource, method, pathName, action) ? `${method} ${pathName} ${action}` : `MISSING ${method} ${pathName}`,
        )
      : ['MISSING_RESOURCE'];
  }
  const sched = findResource(matrix, 'api.scheduling');
  out.schedulingResourceCreate = sched
    ? hasOp(sched, 'POST', '/scheduling/resources', 'manage')
    : false;
  out.receptionistCanLink = (findResource(matrix, 'api.treatment-plan-links')?.permissions?.create ?? []).includes(
    'receptionist',
  );
  out.labTechCanLab = (findResource(matrix, 'api.dental-lab')?.permissions?.create ?? []).includes(
    'lab_technician',
  );
  return JSON.stringify(out);
}

export function collectWaveDPermissionErrors() {
  const errors = [];
  const matrices = Object.fromEntries(Object.entries(PATHS).map(([k, p]) => [k, load(p)]));
  const fps = [];
  for (const [label, matrix] of Object.entries(matrices)) {
    for (const [id, ops] of Object.entries(WAVE_D_OPS)) {
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
    const sched = findResource(matrix, 'api.scheduling');
    if (!sched || !hasOp(sched, 'POST', '/scheduling/resources', 'manage')) {
      errors.push(`${label}: missing POST /scheduling/resources manage`);
    }
    fps.push(fingerprint(matrix));
  }
  if (new Set(fps).size !== 1) {
    errors.push('Wave D permission fingerprints differ across the three matrices');
  }
  const apiSrc = path.join(repoRoot, 'apps/api/src/modules');
  for (const [file, marker] of CONTROLLER_ROUTE_MARKERS) {
    const found = fs
      .readdirSync(apiSrc, { recursive: true })
      .some((rel) => String(rel).endsWith(file) && fs.readFileSync(path.join(apiSrc, rel), 'utf8').includes(marker));
    if (!found) errors.push(`Missing controller marker ${file} ${marker}`);
  }
  return errors;
}

if (process.argv[1] && path.normalize(process.argv[1]).includes('validate-phase48-wave-d-permission-routes')) {
  const errors = collectWaveDPermissionErrors();
  if (errors.length) {
    console.error('Wave D permission-route validation failed:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('Wave D permission-route validation PASS');
}
