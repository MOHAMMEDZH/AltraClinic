#!/usr/bin/env node
/**
 * Phase 48 Wave B PA — booking-integrity permission-route validation across 3 matrices.
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

const BOOKING_INTEGRITY_OPS = [
  ['GET', '/scheduling/booking-integrity/eligibilities', 'view'],
  ['POST', '/scheduling/booking-integrity/eligibilities', 'manage'],
  ['POST', '/scheduling/booking-integrity/eligibilities/:id/deactivate', 'manage'],
  ['GET', '/scheduling/booking-integrity/eligibilities/readiness', 'view'],
  ['POST', '/scheduling/booking-integrity/eligibilities/enforcement/activate', 'manage'],
  ['GET', '/scheduling/booking-integrity/resource-requirements', 'view'],
  ['PUT', '/scheduling/booking-integrity/resource-requirements', 'manage'],
  ['GET', '/scheduling/booking-integrity/appointments/:id/snapshots', 'view'],
  ['POST', '/scheduling/booking-integrity/appointments/:id/commercial-correction', 'manage'],
];

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(errors) {
  console.error('Wave B permission-route validation failed:');
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
    const scheduling = findResource(matrix, 'api.scheduling');
    if (!scheduling) {
      errors.push(`${label}: missing api.scheduling`);
      continue;
    }
    for (const [method, pathName, action] of BOOKING_INTEGRITY_OPS) {
      if (!hasOp(scheduling, method, pathName, action)) {
        errors.push(`${label}: missing ${method} ${pathName} action=${action}`);
      }
    }
  }

  if (errors.length) fail(errors);
  console.log('PHASE48_WAVE_B_PERMISSION_ROUTES_VALIDATOR_PASSED');
}

main();
