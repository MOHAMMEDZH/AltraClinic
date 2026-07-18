import type { EncounterDetail } from '../types/emr.types';

export function printEncounterSummary(encounter: EncounterDetail, locale: string): void {
  const html = buildEncounterHtml(encounter, locale);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildEncounterHtml(encounter: EncounterDetail, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(encounter.createdAt),
  );
  const dx = encounter.diagnoses.map((d) => `<li>${esc(d.code)} — ${esc(d.description)}</li>`).join('');
  const rx = encounter.medications
    .map(
      (m) =>
        `<li>${esc(m.name)} ${esc(m.dose ?? '')} ${esc(m.route ?? '')} ${esc(m.frequency ?? '')}</li>`,
    )
    .join('');
  const soap = encounter.soapNotes;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Clinical Summary — ${esc(encounter.patientName)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:2rem;color:#111;max-width:720px;margin:0 auto}
h1{font-size:1.25rem;margin:0 0 .5rem} h2{font-size:1rem;margin:1.5rem 0 .5rem;border-bottom:1px solid #ccc}
.meta{color:#555;font-size:.875rem} ul{margin:.25rem 0;padding-left:1.25rem}
.section{white-space:pre-wrap;font-size:.9rem}
@media print{body{padding:0}}
</style></head><body>
<h1>${esc(encounter.patientName)}</h1>
<p class="meta">${date} · Status: ${esc(encounter.status)}</p>
<p><strong>Chief complaint:</strong> ${esc(encounter.chiefComplaint ?? '—')}</p>
<h2>Diagnoses</h2><ul>${dx || '<li>None</li>'}</ul>
<h2>Prescriptions</h2><ul>${rx || '<li>None</li>'}</ul>
<h2>SOAP Notes</h2>
<div class="section"><strong>S:</strong> ${esc(soap.subjective ?? '')}</div>
<div class="section"><strong>O:</strong> ${esc(soap.objective ?? '')}</div>
<div class="section"><strong>A:</strong> ${esc(soap.assessment ?? '')}</div>
<div class="section"><strong>P:</strong> ${esc(soap.plan ?? '')}</div>
<p class="meta" style="margin-top:2rem">Generated from clinical records · ${new Date().toISOString()}</p>
</body></html>`;
}
