import { describe, expect, it } from 'vitest';
import { validateWorkflowBlueprint } from './validate-workflow-blueprint';

describe('validateWorkflowBlueprint', () => {
  it('requires names and at least one labeled step', () => {
    expect(
      validateWorkflowBlueprint({
        nameEn: '',
        nameAr: '',
        steps: [{ type: 'task', labelEn: '', labelAr: '' }],
      }),
    ).toEqual(['nameEn', 'nameAr', 'steps']);
  });

  it('passes for a minimal valid blueprint', () => {
    expect(
      validateWorkflowBlueprint({
        nameEn: 'Onboarding',
        nameAr: 'إعداد',
        steps: [{ type: 'task', labelEn: 'Review', labelAr: 'مراجعة' }],
      }),
    ).toEqual([]);
  });
});
