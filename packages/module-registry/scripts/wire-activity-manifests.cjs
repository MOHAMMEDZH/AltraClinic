const fs = require('fs');
const path = 'packages/module-registry/src/builtin/builtin-manifests.ts';
let s = fs.readFileSync(path, 'utf8');
const marker = 'activity: moduleActivityContributions(s.moduleId),';
if (s.includes(marker)) {
  console.log('already wired');
  process.exit(0);
}
s = s.replace(/buildExtensions: \(s\) => \(\{([\s\S]*?)\}\),/g, (full, body) => {
  if (body.includes('moduleActivityContributions')) return full;
  let newBody = body;
  if (/search: moduleSearchContributions\(s\.moduleId\),/.test(body)) {
    newBody = body.replace(
      /(search: moduleSearchContributions\(s\.moduleId\),)/,
      '$1\n      activity: moduleActivityContributions(s.moduleId),',
    );
  } else if (/dashboard: buildDashboardContributionsForModule\(s\.moduleId\),/.test(body)) {
    newBody = body.replace(
      /(dashboard: buildDashboardContributionsForModule\(s\.moduleId\),)/,
      '$1\n      activity: moduleActivityContributions(s.moduleId),',
    );
  } else {
    newBody = '\n      activity: moduleActivityContributions(s.moduleId),' + body;
  }
  return 'buildExtensions: (s) => ({' + newBody + '}),';
});
fs.writeFileSync(path, s);
console.log('wired count', (s.match(/moduleActivityContributions/g) || []).length);
