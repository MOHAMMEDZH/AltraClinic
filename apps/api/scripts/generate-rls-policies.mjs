#!/usr/bin/env node
/**
 * Generates prisma/rls-policies.sql and docs/RLS_COVERAGE_MATRIX.md from schema.prisma.
 * Prisma PostgreSQL columns use quoted camelCase (e.g. "tenantId") unless @map is set on fields.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

const GLOBAL_TABLES = new Set([
  'tenants',
  'platform_tenants',
  'privileged_access_grants',
  'platform_subscriptions',
]);

const PLATFORM_ONLY = new Set(['platform_tenants', 'privileged_access_grants', 'platform_subscriptions']);

/** Indirect tenant ownership via parent table */
const INDIRECT = {
  patient_addresses: { parent: 'patients', fk: 'patientId', parentPk: 'id' },
  user_role_assignments: { parent: 'users', fk: 'userId', parentPk: 'id' },
  invoice_line_items: { parent: 'invoices', fk: 'invoiceId', parentPk: 'id' },
  invoice_payments: { parent: 'invoices', fk: 'invoiceId', parentPk: 'id' },
  invoice_refunds: { parent: 'invoices', fk: 'invoiceId', parentPk: 'id' },
  credit_notes: { parent: 'invoices', fk: 'invoiceId', parentPk: 'id' },
  invoice_write_offs: { parent: 'invoices', fk: 'invoiceId', parentPk: 'id' },
  payment_plan_installments: { parent: 'payment_plans', fk: 'planId', parentPk: 'id' },
  commission_line_items: { parent: 'commission_calculations', fk: 'commissionId', parentPk: 'id' },
  purchase_order_lines: { parent: 'purchase_orders', fk: 'purchaseOrderId', parentPk: 'id' },
  inventory_stock_transfer_lines: { parent: 'inventory_stock_transfers', fk: 'stockTransferId', parentPk: 'id' },
  inventory_stock_count_lines: { parent: 'inventory_stock_counts', fk: 'stockCountId', parentPk: 'id' },
  inventory_stock_request_lines: { parent: 'inventory_stock_requests', fk: 'stockRequestId', parentPk: 'id' },
  treatment_phases: { parent: 'treatment_plans', fk: 'planId', parentPk: 'id' },
  treatment_plan_items: { parent: 'treatment_phases', fk: 'phaseId', parentPk: 'id', chain: { parent: 'treatment_plans', fk: 'planId', via: 'treatment_phases' } },
  queue_ticket_events: { parent: 'queue_tickets', fk: 'ticketId', parentPk: 'id' },
  notification_template_versions: { parent: 'notification_templates', fk: 'templateId', parentPk: 'id' },
  ai_prompt_versions: { parent: 'ai_prompts', fk: 'promptId', parentPk: 'id' },
  ai_messages: { parent: 'ai_conversations', fk: 'conversationId', parentPk: 'id' },
  encounter_events: { parent: 'encounters', fk: 'encounterId', parentPk: 'id' },
  dental_tooth_conditions: { parent: 'dental_records', fk: 'dentalRecordId', parentPk: 'id' },
  beauty_annotations: { parent: 'beauty_records', fk: 'beautyRecordId', parentPk: 'id' },
};

function parseModels(src) {
  const models = [];
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const body = m[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const table = mapMatch ? mapMatch[1] : name;
    const fields = {};
    for (const line of body.split('\n')) {
      const fm = line.match(/^\s*(\w+)\s+/);
      if (!fm || line.trim().startsWith('//') || line.includes('@@')) continue;
      const field = fm[1];
      if (line.includes('@relation')) continue;
      const colMap = line.match(/@map\("([^"]+)"\)/);
      fields[field] = colMap ? colMap[1] : field;
    }
    models.push({ name, table, fields });
  }
  return models;
}

function qIdent(name) {
  return `"${name}"`;
}

function tenantExpr() {
  return `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`;
}

function bypassExpr() {
  return `current_setting('app.platform_rls_bypass', true) = 'true'`;
}

function directUsing(table, tenantCol) {
  return `${qIdent(tenantCol)} = ${tenantExpr()} OR ${bypassExpr()}`;
}

function indirectUsing(table, spec) {
  const parentTenant = `"tenantId"`;
  return `EXISTS (
    SELECT 1 FROM ${spec.parent} p
    WHERE p.${qIdent(spec.parentPk)} = ${table}.${qIdent(spec.fk)}
      AND p.${parentTenant} = ${tenantExpr()}
  ) OR ${bypassExpr()}`;
}

function outboxUsing() {
  return `"tenantId" IS NULL OR "tenantId" = ${tenantExpr()} OR ${bypassExpr()}`;
}

const models = parseModels(schema);
const matrix = [];
const sqlParts = [
  '-- =============================================================================',
  '-- Row-Level Security Policies (auto-generated — do not edit by hand)',
  `-- Generated: ${new Date().toISOString()}`,
  '-- Run after every `prisma migrate deploy`: npm run db:rls:apply',
  '-- Requires session vars: app.current_tenant_id, app.platform_rls_bypass',
  '-- =============================================================================',
  '',
  'CREATE OR REPLACE FUNCTION app_rls_tenant_id() RETURNS uuid AS $$',
  '  SELECT NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid;',
  '$$ LANGUAGE sql STABLE;',
  '',
  'CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$',
  '  SELECT current_setting(\'app.platform_rls_bypass\', true) = \'true\';',
  '$$ LANGUAGE sql STABLE;',
  '',
];

for (const model of models) {
  const { table, fields } = model;
  const hasTenant = 'tenantId' in fields;
  const indirect = INDIRECT[table];
  const isGlobal = GLOBAL_TABLES.has(table);
  const isPlatform = PLATFORM_ONLY.has(table);

  let policyType = 'global';
  let usingClause = null;

  if (table === 'outbox_events') {
    policyType = 'outbox';
    usingClause = outboxUsing();
  } else if (isGlobal && !hasTenant) {
    policyType = 'global';
  } else if (indirect && !hasTenant) {
    policyType = 'indirect';
    usingClause = indirectUsing(table, indirect);
  } else if (hasTenant) {
    policyType = 'direct';
    usingClause = directUsing(table, fields.tenantId);
  } else {
    policyType = 'unscoped';
  }

  const rlsEnabled = !isGlobal && policyType !== 'unscoped';
  const force = rlsEnabled;

  matrix.push({
    model: model.name,
    table,
    ownership: policyType,
    rls: rlsEnabled,
    force,
    select: rlsEnabled,
    insert: rlsEnabled,
    update: rlsEnabled,
    delete: rlsEnabled,
    notes: isPlatform ? 'Platform control plane — no tenant RLS' : policyType === 'unscoped' ? 'Review manually' : '',
  });

  if (!rlsEnabled || !usingClause) continue;

  sqlParts.push(`-- ${model.name} → ${table}`);
  sqlParts.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  sqlParts.push(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
  for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const check = op === 'SELECT' || op === 'DELETE' ? 'USING' : op === 'INSERT' ? 'WITH CHECK' : 'USING';
    const checkClause = usingClause;
    const withCheck = op === 'INSERT' || op === 'UPDATE' ? `\n  WITH CHECK (${usingClause})` : '';
    sqlParts.push(`DROP POLICY IF EXISTS tenant_${op.toLowerCase()} ON ${table};`);
    if (op === 'INSERT') {
      sqlParts.push(`CREATE POLICY tenant_insert ON ${table} FOR INSERT WITH CHECK (${usingClause});`);
    } else if (op === 'UPDATE') {
      sqlParts.push(
        `CREATE POLICY tenant_update ON ${table} FOR UPDATE USING (${usingClause}) WITH CHECK (${usingClause});`,
      );
    } else {
      sqlParts.push(`CREATE POLICY tenant_${op.toLowerCase()} ON ${table} FOR ${op} USING (${usingClause});`);
    }
  }
  sqlParts.push('');
}

writeFileSync(join(apiRoot, 'prisma', 'rls-policies.sql'), sqlParts.join('\n'), 'utf8');

const md = [
  '# RLS Coverage Matrix',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '| Prisma model | PostgreSQL table | Ownership | RLS | Force | Select | Insert | Update | Delete | Test | Notes |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...matrix.map((r) =>
    `| ${r.model} | ${r.table} | ${r.ownership} | ${r.rls ? 'yes' : 'no'} | ${r.force ? 'yes' : 'no'} | ${r.select ? 'yes' : '-'} | ${r.insert ? 'yes' : '-'} | ${r.update ? 'yes' : '-'} | ${r.delete ? 'yes' : '-'} | integration | ${r.notes} |`,
  ),
  '',
  '## Deployment order',
  '',
  '1. `npm run db:migrate:deploy`',
  '2. `npm run db:triggers:apply`',
  '3. `npm run db:rls:apply`',
  '4. `npm run db:seed` (non-production only)',
  '',
].join('\n');

writeFileSync(join(apiRoot, '..', '..', 'docs', 'RLS_COVERAGE_MATRIX.md'), md, 'utf8');
console.log(`Generated RLS for ${matrix.filter((m) => m.rls).length} tables; matrix rows: ${matrix.length}`);
