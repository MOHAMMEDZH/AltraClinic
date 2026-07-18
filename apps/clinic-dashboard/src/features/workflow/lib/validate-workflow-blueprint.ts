import type { WorkflowStepDef } from '../config/workflow-config';

export function validateWorkflowBlueprint(input: {
  nameEn: string;
  nameAr: string;
  steps: WorkflowStepDef[];
}): string[] {
  const errors: string[] = [];
  if (!input.nameEn.trim()) errors.push('nameEn');
  if (!input.nameAr.trim()) errors.push('nameAr');
  const labeled = input.steps.filter((s) => s.labelEn.trim());
  if (labeled.length === 0) errors.push('steps');
  for (const step of labeled) {
    if (step.type === 'webhook' && !step.config?.url && !step.branchCondition) {
      errors.push(`webhook:${step.id ?? step.labelEn}`);
    }
  }
  return errors;
}
