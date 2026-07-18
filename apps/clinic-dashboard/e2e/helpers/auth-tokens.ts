import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../api');

function mintToken(kind: 'reset' | 'verify', email: string, tenantId: string): string {
  return execSync(`node scripts/mint-e2e-auth-token.mjs ${kind} "${email}" "${tenantId}"`, {
    cwd: apiDir,
    encoding: 'utf8',
  }).trim();
}

export function mintPasswordResetToken(email: string, tenantId: string): string {
  return mintToken('reset', email, tenantId);
}

export function mintEmailVerificationToken(email: string, tenantId: string): string {
  return mintToken('verify', email, tenantId);
}

export function restoreDemoSeed(): void {
  execSync('npx prisma db seed', { cwd: apiDir, stdio: 'pipe' });
}
