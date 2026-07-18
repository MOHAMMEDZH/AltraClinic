import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const API_ROOT = join(__dirname, '..', '..', '..', '..');
const RESULTS_FILE = join(API_ROOT, 'notification-load-test-results.json');
const LOAD_TEST_MIN_COUNT = 100_000;
const RUN_INTEGRATION = process.env.NOTIFICATION_LOAD_TEST === '1';

(RUN_INTEGRATION ? describe : describe.skip)('Notification inbox load test (100k+ DB integration)', () => {
  it('passes benchmark suite against live database', () => {
    execSync('node scripts/notification-load-test.mjs --benchmark-only', {
      cwd: API_ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
    expect(existsSync(RESULTS_FILE)).toBe(true);
    const report = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as {
      totalRows: number;
      passed: boolean;
    };
    expect(report.totalRows).toBeGreaterThanOrEqual(LOAD_TEST_MIN_COUNT);
    expect(report.passed).toBe(true);
  });
});

describe('Notification load test results artifact', () => {
  it('validates saved benchmark report when NOTIFICATION_LOAD_TEST_RESULTS=1', () => {
    if (process.env.NOTIFICATION_LOAD_TEST_RESULTS !== '1') return;
    expect(existsSync(RESULTS_FILE)).toBe(true);
    const report = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as {
      totalRows: number;
      passed: boolean;
      benchmarks: { name: string; passed: boolean; durationMs: number; thresholdMs: number }[];
    };
    expect(report.totalRows).toBeGreaterThanOrEqual(LOAD_TEST_MIN_COUNT);
    expect(report.passed).toBe(true);
    expect(report.benchmarks.length).toBeGreaterThanOrEqual(4);
  });
});
