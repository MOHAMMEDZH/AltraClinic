/** One-off debug script — run: node scripts/debug-generate-report.mjs */
const TENANT = 'a1000000-0000-4000-8000-000000000001';

const login = await fetch('http://127.0.0.1:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'owner@demo.clinic',
    password: 'Owner123!',
    tenantId: TENANT,
    deviceName: 'debug',
  }),
});

if (!login.ok) {
  console.error('login failed', login.status, await login.text());
  process.exit(1);
}

const { accessToken } = await login.json();
const resp = await fetch('http://127.0.0.1:3000/analytics/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'x-tenant-id': TENANT,
  },
  body: JSON.stringify({
    name: 'QA test report',
    reportType: 'financial',
    format: 'csv',
    parameters: { range: '7d' },
  }),
});

console.log('status', resp.status);
console.log(await resp.text());
