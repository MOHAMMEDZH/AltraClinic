import { LicensedFeatureId } from '../../../subscription/domain/config/licensing.config';
import { AiWorkspaceFeature, workspaceToAiFeature } from '../config/ai-plan-limits.config';

/** Maps AI workspace identifiers to LicensedFeatureId for backend enforcement. */
export function workspaceToLicensedFeature(workspaceId: string | null | undefined): LicensedFeatureId | null {
  const feature = workspaceToAiFeature(workspaceId);
  const map: Partial<Record<AiWorkspaceFeature, LicensedFeatureId>> = {
    medical: 'medicalCopilot',
    dental: 'dentalCopilot',
    reporting: 'reportingAi',
    inventory: 'inventoryAi',
  };
  return map[feature] ?? null;
}
