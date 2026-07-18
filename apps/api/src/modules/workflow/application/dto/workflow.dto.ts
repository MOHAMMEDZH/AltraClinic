export class WorkflowDto {
  workflowId: string;
  tenantId: string;
  branchId?: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  steps: string[];
  currentStepIndex: number;
  currentStep: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  canceledBy?: string | null;
  canceledAt?: string | null;
  cancelReason?: string | null;
}
