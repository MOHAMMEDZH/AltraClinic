import type { PatientTimelineEntry } from '../types';

export function timelineEntryHref(
  patientId: string,
  entry: PatientTimelineEntry,
): string | null {
  switch (entry.type) {
    case 'appointment':
      return `/appointments?view=list&selected=${encodeURIComponent(entry.id)}`;
    case 'encounter':
      return `/encounters/${entry.id}`;
    case 'invoice':
      return `/billing/invoices?patientId=${encodeURIComponent(patientId)}`;
    case 'imaging':
      return `/dental/imaging/${patientId}`;
    case 'perio':
      return `/dental/chart/${patientId}?tab=perio`;
    case 'diagnosis':
    case 'prescription':
      return entry.metadata?.encounterId
        ? `/encounters/${entry.metadata.encounterId as string}`
        : `/encounters?patientId=${encodeURIComponent(patientId)}`;
    case 'treatment':
      return entry.metadata?.planId
        ? `/dental/chart/${patientId}/plan/${entry.metadata.planId as string}`
        : `/dental/chart/${patientId}?tab=treatment`;
    case 'ortho':
      return `/dental/chart/${patientId}?tab=ortho`;
    case 'implant':
      return `/dental/chart/${patientId}?tab=implants`;
    case 'dental_note':
      return `/dental/chart/${patientId}?tab=notes`;
    case 'procedure':
      return `/dental/chart/${patientId}?tab=procedures`;
    default:
      return null;
  }
}
