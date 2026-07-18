/**
 * Phase 42a — Activity event name registry only.
 * Does NOT emit Activity at runtime.
 */
import { IMPORT_EXPORT_ACTIVITY_EVENTS } from '../import-export.constants';

export type ImportExportActivityEventName = (typeof IMPORT_EXPORT_ACTIVITY_EVENTS)[number];

export class ImportExportActivityContracts {
  readonly eventNames: readonly ImportExportActivityEventName[] = IMPORT_EXPORT_ACTIVITY_EVENTS;

  listEventNames(): readonly ImportExportActivityEventName[] {
    return this.eventNames;
  }
}
