"use strict";
/**
 * Permission System Seeds
 *
 * Generates the canonical permission entries for every resource × action × role
 * triple defined in the permission matrix.
 *
 * Usage:
 *   ts-node prisma/seeds/permission-seeds.ts
 *   — or via npx ts-node if installed locally —
 *   npx ts-node prisma/seeds/permission-seeds.ts
 *
 * These seeds are idempotent: duplicate inserts are skipped with upsert logic.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoleSeeds = generateRoleSeeds;
exports.generatePermissionSeeds = generatePermissionSeeds;
exports.generateRolePermissionSeeds = generateRolePermissionSeeds;
exports.generateSQLSeeds = generateSQLSeeds;
exports.buildPrismaUpserts = buildPrismaUpserts;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ---------------------------------------------------------------------------
// Load matrix
// ---------------------------------------------------------------------------
const MATRIX_PATH = path.resolve(__dirname, '../../config/permission-matrix.json');
function loadMatrix() {
    const raw = fs.readFileSync(MATRIX_PATH, 'utf-8');
    return JSON.parse(raw);
}
function generateRoleSeeds(matrix) {
    const descriptions = {
        super_admin: 'Full platform access — cross-tenant control plane',
        owner: 'Clinic owner — full access within tenant',
        general_manager: 'General manager — operational control within tenant',
        doctor: 'Licensed physician — clinical access',
        dentist: 'Licensed dentist — dental clinical access',
        specialist: 'Specialist clinician — specialized clinical access',
        nurse: 'Nursing staff — care coordination access',
        assistant: 'Clinical/administrative assistant',
        receptionist: 'Front-desk reception — scheduling and check-in',
        accountant: 'Finance and billing management',
        inventory_manager: 'Inventory and supply chain management',
        patient: 'Self-service patient portal access',
    };
    return matrix.roles.map((role) => ({
        key: role.key,
        name: role.name,
        description: descriptions[role.key] ?? role.name,
    }));
}
function generatePermissionSeeds(matrix) {
    const seeds = [];
    for (const resource of matrix.resources) {
        for (const action of matrix.actions) {
            seeds.push({
                id: `${resource.id}:${action}`,
                resource: resource.id,
                action,
                resourceKind: resource.kind,
                resourceName: resource.name,
            });
        }
    }
    return seeds;
}
function generateRolePermissionSeeds(matrix) {
    const seeds = [];
    for (const resource of matrix.resources) {
        for (const action of matrix.actions) {
            const grantedRoles = resource.permissions[action] ?? [];
            for (const roleKey of grantedRoles) {
                seeds.push({
                    roleKey,
                    permissionId: `${resource.id}:${action}`,
                });
            }
        }
    }
    return seeds;
}
// ---------------------------------------------------------------------------
// SQL generation helpers
// ---------------------------------------------------------------------------
function escStr(s) {
    return `'${s.replace(/'/g, "''")}'`;
}
function generateSQLSeeds(matrix) {
    const roles = generateRoleSeeds(matrix);
    const permissions = generatePermissionSeeds(matrix);
    const rolePermissions = generateRolePermissionSeeds(matrix);
    const lines = [
        '-- ============================================================',
        '-- Permission System Seeds',
        `-- Generated: ${new Date().toISOString()}`,
        `-- Matrix version: ${matrix.version}`,
        '-- ============================================================',
        '',
        '-- Roles',
        'INSERT INTO "Role" (key, name, description) VALUES',
        roles.map((r) => `  (${escStr(r.key)}, ${escStr(r.name)}, ${escStr(r.description)})`).join(',\n'),
        'ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;',
        '',
        '-- Permissions (resource × action)',
        'INSERT INTO "Permission" (id, resource, action, resource_kind, resource_name) VALUES',
        permissions.map((p) => `  (${escStr(p.id)}, ${escStr(p.resource)}, ${escStr(p.action)}, ${escStr(p.resourceKind)}, ${escStr(p.resourceName)})`).join(',\n'),
        'ON CONFLICT (id) DO UPDATE SET resource_name = EXCLUDED.resource_name;',
        '',
        '-- Role ↔ Permission assignments',
        'INSERT INTO "RolePermission" (role_key, permission_id) VALUES',
        rolePermissions.map((rp) => `  (${escStr(rp.roleKey)}, ${escStr(rp.permissionId)})`).join(',\n'),
        'ON CONFLICT (role_key, permission_id) DO NOTHING;',
        '',
    ];
    return lines.join('\n');
}
// ---------------------------------------------------------------------------
// Prisma seed helper (returns objects you can pass to prisma.create / upsert)
// ---------------------------------------------------------------------------
function buildPrismaUpserts(matrix) {
    return {
        roles: generateRoleSeeds(matrix),
        permissions: generatePermissionSeeds(matrix),
        rolePermissions: generateRolePermissionSeeds(matrix),
    };
}
// ---------------------------------------------------------------------------
// Standalone runner
// ---------------------------------------------------------------------------
if (require.main === module) {
    const matrix = loadMatrix();
    const sql = generateSQLSeeds(matrix);
    const outPath = path.resolve(__dirname, 'permissions.seed.sql');
    fs.writeFileSync(outPath, sql, 'utf-8');
    const roles = generateRoleSeeds(matrix);
    const permissions = generatePermissionSeeds(matrix);
    const rolePermissions = generateRolePermissionSeeds(matrix);
    console.log(`\nPermission Seeds generated (matrix v${matrix.version})`);
    console.log(`  Roles:            ${roles.length}`);
    console.log(`  Permissions:      ${permissions.length}`);
    console.log(`  Role Assignments: ${rolePermissions.length}`);
    console.log(`\nSQL written to: ${outPath}`);
    // Print JSON summary
    const jsonOut = path.resolve(__dirname, 'permissions.seed.json');
    fs.writeFileSync(jsonOut, JSON.stringify({ roles, permissions, rolePermissions }, null, 2));
    console.log(`JSON written to: ${jsonOut}`);
}
