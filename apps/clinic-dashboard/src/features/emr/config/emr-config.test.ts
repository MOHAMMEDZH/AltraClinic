import { describe, expect, it } from 'vitest';
import {
  canCreateEmr,
  canSignEmr,
  canUpdateEmr,
  canViewEmr,
  defaultTabForViewMode,
  checkDrugAllergies,
  checkDrugInteractions,
  getVitalValue,
  isEncounterEditable,
  isPendingDocumentation,
  resolveEmrViewMode,
  setVitalValue,
  statusLabelKey,
} from './emr-config';

describe('emr-config', () => {
  it('gates EMR permissions', () => {
    const view = (action: string) => action === 'view';
    const create = (action: string) => action === 'create';
    const approve = (action: string) => action === 'approve';
    expect(canViewEmr(view)).toBe(true);
    expect(canCreateEmr(create)).toBe(true);
    expect(canUpdateEmr(view)).toBe(false);
    expect(canSignEmr(approve)).toBe(true);
  });

  it('resolves workspace view modes and default tabs', () => {
    expect(resolveEmrViewMode(['doctor'])).toBe('doctor');
    expect(resolveEmrViewMode(['nurse'])).toBe('nurse');
    expect(resolveEmrViewMode(['owner'])).toBe('manager');
    expect(defaultTabForViewMode('nurse')).toBe('vitals');
    expect(defaultTabForViewMode('doctor')).toBe('overview');
  });

  it('detects pending documentation and editability', () => {
    expect(isPendingDocumentation({ status: 'in_progress', chiefComplaint: '', diagnosesCount: 0, observationsCount: 2 })).toBe(true);
    expect(isPendingDocumentation({ status: 'signed', chiefComplaint: 'Headache', diagnosesCount: 1, observationsCount: 0 })).toBe(false);
    expect(isEncounterEditable({ status: 'signed' })).toBe(false);
    expect(isEncounterEditable({ status: 'in_progress' })).toBe(true);
    expect(statusLabelKey('completed')).toBe('emr.status.completed');
  });

  it('detects drug allergy conflicts', () => {
    const warnings = checkDrugAllergies(['Penicillin'], [{ name: 'Amoxicillin' }]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('detects drug–drug interactions', () => {
    const warnings = checkDrugInteractions([
      { name: 'Warfarin' },
      { name: 'Ibuprofen' },
    ]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
