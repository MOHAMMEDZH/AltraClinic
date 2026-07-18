import fs from 'node:fs';
import path from 'node:path';

const matrixPath = path.resolve(process.cwd(), '../../docs/permission-matrix.json');

function fail(errors) {
  console.error('Permission matrix validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

function main() {
  if (!fs.existsSync(matrixPath)) {
    fail([`Matrix file not found at ${matrixPath}`]);
  }

  const raw = fs.readFileSync(matrixPath, 'utf8');
  const matrix = JSON.parse(raw);
  const errors = [];

  const requiredRoles = [
    'super_admin',
    'owner',
    'general_manager',
    'doctor',
    'dentist',
    'specialist',
    'nurse',
    'assistant',
    'receptionist',
    'accountant',
    'inventory_manager',
    'patient',
  ];

  const requiredActions = ['view', 'create', 'update', 'delete', 'approve', 'export'];
  const roleSet = new Set((matrix.roles || []).map((r) => r.key));

  for (const role of requiredRoles) {
    if (!roleSet.has(role)) {
      errors.push(`Missing required role: ${role}`);
    }
  }

  if (JSON.stringify(matrix.actions) !== JSON.stringify(requiredActions)) {
    errors.push('matrix.actions must equal [view, create, update, delete, approve, export] in this exact order');
  }

  const resourceIds = new Set();

  for (const resource of matrix.resources || []) {
    if (!resource.id) {
      errors.push('Resource without id');
      continue;
    }

    if (resourceIds.has(resource.id)) {
      errors.push(`Duplicate resource id: ${resource.id}`);
    }
    resourceIds.add(resource.id);

    for (const action of requiredActions) {
      if (!resource.permissions || !Array.isArray(resource.permissions[action])) {
        errors.push(`Resource ${resource.id} missing permissions for action ${action}`);
        continue;
      }

      const allowedRoles = resource.permissions[action];
      if (!allowedRoles.includes('super_admin')) {
        errors.push(`Resource ${resource.id} action ${action} must include super_admin`);
      }

      for (const role of allowedRoles) {
        if (!roleSet.has(role)) {
          errors.push(`Resource ${resource.id} action ${action} includes unknown role ${role}`);
        }
      }
    }

    for (const operation of resource.operations || []) {
      if (!requiredActions.includes(operation.action)) {
        errors.push(`Resource ${resource.id} has invalid operation action ${operation.action}`);
      }
      if (!operation.method || !operation.path) {
        errors.push(`Resource ${resource.id} has operation with missing method/path`);
      }
    }

    if (resource.id.startsWith('api.platform_admin')) {
      for (const action of ['create', 'update', 'delete', 'approve']) {
        const nonSuper = (resource.permissions[action] || []).filter((r) => r !== 'super_admin');
        if (nonSuper.length > 0) {
          errors.push(`Resource ${resource.id} action ${action} must be super_admin-only`);
        }
      }
    }

    if (!resource.id.startsWith('api.patient_portal') && !resource.id.startsWith('screen.patient_portal')) {
      if ((resource.permissions.approve || []).includes('patient')) {
        errors.push(`Resource ${resource.id}: patient cannot have approve permission`);
      }
      if ((resource.permissions.delete || []).includes('patient')) {
        errors.push(`Resource ${resource.id}: patient cannot have delete permission`);
      }
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log(`Permission matrix is valid: ${matrix.resources.length} resources, ${matrix.roles.length} roles.`);
}

main();
