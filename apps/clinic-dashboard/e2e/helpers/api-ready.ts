import fs from 'node:fs';

import path from 'node:path';

import { fileURLToPath } from 'node:url';



/** Single source of truth — must match global-setup.ts write location. */

export const E2E_API_READY_FLAG_PATH = path.join(

  path.dirname(fileURLToPath(import.meta.url)),

  '.api-ready',

);



export function isE2eApiReady(): boolean {

  try {

    return fs.readFileSync(E2E_API_READY_FLAG_PATH, 'utf8').trim() === '1';

  } catch {

    return false;

  }

}



export function writeE2eApiReadyFlag(ready: boolean): void {

  fs.writeFileSync(E2E_API_READY_FLAG_PATH, ready ? '1' : '0', 'utf8');

}



export const E2E_SKIP_REASON =

  'API unavailable — start apps/api (`npm run dev`), seed demo data (`npx prisma db seed`), then re-run test:e2e';


