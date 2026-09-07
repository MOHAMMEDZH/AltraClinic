/**
 * Step 28 — safe repository secret pattern scan (never prints secret values).
 * Exit 0 when no high-confidence committed secret patterns found in scanned paths.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '../..');

const SCAN_ROOTS = [
  path.join(repoRoot, 'apps/api/src'),
  path.join(repoRoot, 'apps/super-admin/src'),
  path.join(repoRoot, 'docs'),
];

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  'generated',
]);

const FILE_RE = /\.(ts|tsx|js|mjs|cjs|md|json|yml|yaml|env\.example)$/i;

const PATTERNS = [
  {
    id: 'SEC01_private_key_block',
    re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: 'CRITICAL',
  },
  {
    id: 'SEC02_aws_access_key_id',
    re: /AKIA[0-9A-Z]{16}/,
    severity: 'HIGH',
  },
  {
    id: 'SEC03_generic_password_assignment',
    re: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{12,}['"]/i,
    severity: 'HIGH',
  },
  {
    id: 'SEC04_bearer_literal',
    re: /Authorization:\s*Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
    severity: 'HIGH',
  },
];

const ALLOWLIST_PATH_SUBSTR = [
  `${path.sep}tests${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
  '.spec.ts',
  '.spec.tsx',
  '.example',
  'SECURITY_HARDENING',
  'SECURITY_RUNBOOKS',
  'STEP_28_PENETRATION',
  'platform-security.config.spec',
  'step28-security-hardening',
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIR_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (FILE_RE.test(ent.name)) out.push(full);
  }
}

function isAllowlisted(file) {
  const norm = file.toLowerCase();
  return ALLOWLIST_PATH_SUBSTR.some((s) => norm.includes(s.toLowerCase()));
}

const findings = [];
const files = [];
for (const root of SCAN_ROOTS) walk(root, files);

for (const file of files) {
  if (isAllowlisted(file)) continue;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of PATTERNS) {
      if (!p.re.test(line)) continue;
      findings.push({
        id: p.id,
        severity: p.severity,
        file: path.relative(repoRoot, file).replace(/\\/g, '/'),
        line: i + 1,
        redacted: '[REDACTED_MATCH]',
      });
    }
  }
}

const blocking = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
console.log(
  JSON.stringify(
    {
      type: 'step28_secrets_scan',
      scannedFiles: files.length,
      findings: findings.length,
      blocking: blocking.length,
      items: blocking.map((f) => ({
        id: f.id,
        severity: f.severity,
        file: f.file,
        line: f.line,
        redacted: f.redacted,
      })),
    },
    null,
    2,
  ),
);

if (blocking.length > 0) {
  console.error('Step 28 secrets scan FAILED — blocking findings present (values redacted).');
  process.exit(1);
}

console.log('Step 28 secrets scan PASS — blocking findings = 0');
process.exit(0);
