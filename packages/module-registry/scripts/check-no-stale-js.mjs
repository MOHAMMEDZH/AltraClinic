import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const stale = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.endsWith('.js') || entry.endsWith('.d.ts')) {
      stale.push(full);
    }
  }
}

walk(srcRoot);

if (stale.length > 0) {
  console.error('Stale compiled artifacts detected under packages/module-registry/src:');
  for (const file of stale) {
    console.error(`  - ${file}`);
  }
  console.error(
    'TypeScript sources are authoritative. Remove stale .js/.d.ts emit files and do not commit compiled output.',
  );
  process.exit(1);
}

console.log('module-registry source check passed (no stale .js/.d.ts under src/)');
