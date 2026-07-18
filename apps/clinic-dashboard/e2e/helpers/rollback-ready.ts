import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_ROLLBACK_READY_FLAG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.rollback-ready',
);

export function isRollbackDashboardReady(): boolean {
  try {
    return fs.readFileSync(E2E_ROLLBACK_READY_FLAG_PATH, 'utf8').trim() === '1';
  } catch {
    return false;
  }
}

export function writeRollbackReadyFlag(ready: boolean): void {
  fs.writeFileSync(E2E_ROLLBACK_READY_FLAG_PATH, ready ? '1' : '0', 'utf8');
}
