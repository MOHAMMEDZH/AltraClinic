/**
 * Shared helpers: park/restore Phase 48 migrations that sort after a wave's gates.
 * Used by upgrade validators so later waves (D–G) do not apply during prior-chain deploy.
 */
import fs from 'fs';
import path from 'path';

export function listLaterPhase48Migrations(migrationsDir, excludeNames) {
  const gateSet = new Set(excludeNames);
  const maxGate = [...excludeNames].sort().at(-1);
  if (!maxGate) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.includes('phase48_wave_') &&
        !gateSet.has(entry.name) &&
        entry.name > maxGate,
    )
    .map((entry) => entry.name)
    .sort();
}

export function parkLaterPhase48Migrations(migrationsDir, parkLaterDir, excludeNames) {
  const later = listLaterPhase48Migrations(migrationsDir, excludeNames);
  if (!later.length) return later;
  fs.mkdirSync(parkLaterDir, { recursive: true });
  for (const name of later) {
    const src = path.join(migrationsDir, name);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(parkLaterDir, name);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  return later;
}

export function restoreLaterPhase48Migrations(migrationsDir, parkLaterDir) {
  if (!fs.existsSync(parkLaterDir)) return;
  const parked = fs
    .readdirSync(parkLaterDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of parked) {
    const src = path.join(parkLaterDir, name);
    const dest = path.join(migrationsDir, name);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(src, dest);
  }
  try {
    fs.rmSync(parkLaterDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
