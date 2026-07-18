import { randomUUID } from 'crypto';
import { WorkflowStatusVO } from '../value-objects/workflow-status.vo';
import { WorkflowDomainError } from '../exceptions/workflow-domain.exception';

export interface WorkflowProps {
  workflowId: string;
  tenantId: string;
  branchId?: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  steps: string[];
  currentStepIndex: number;
  status: WorkflowStatusVO;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  canceledBy?: string | null;
  canceledAt?: Date | null;
  cancelReason?: string | null;
}

export class Workflow {
  private readonly props: WorkflowProps;

  private constructor(props: WorkflowProps) {
    this.props = props;
  }

  static create(params: {
    tenantId: string;
    branchId?: string | null;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    steps: string[];
    createdBy: string;
  }): Workflow {
    const now = new Date();
    const steps = Array.isArray(params.steps)
      ? params.steps.map((step) => String(step ?? '').trim()).filter(Boolean)
      : [];

    if (!params.nameEn?.trim()) {
      throw new WorkflowDomainError('English workflow name is required');
    }
    if (!params.nameAr?.trim()) {
      throw new WorkflowDomainError('Arabic workflow name is required');
    }
    if (!params.descriptionEn?.trim()) {
      throw new WorkflowDomainError('English workflow description is required');
    }
    if (!params.descriptionAr?.trim()) {
      throw new WorkflowDomainError('Arabic workflow description is required');
    }
    if (!steps.length) {
      throw new WorkflowDomainError('Workflow steps must contain at least one step');
    }
    if (!params.createdBy?.trim()) {
      throw new WorkflowDomainError('CreatedBy is required');
    }

    return new Workflow({
      workflowId: randomUUID(),
      tenantId: params.tenantId,
      branchId: params.branchId ?? null,
      nameEn: params.nameEn.trim(),
      nameAr: params.nameAr.trim(),
      descriptionEn: params.descriptionEn.trim(),
      descriptionAr: params.descriptionAr.trim(),
      steps,
      currentStepIndex: 0,
      status: new WorkflowStatusVO('active'),
      createdBy: params.createdBy.trim(),
      createdAt: now,
      updatedAt: now,
      canceledBy: null,
      canceledAt: null,
      cancelReason: null,
    });
  }

  /** Reconstitutes a Workflow from persistence. */
  static restore(props: WorkflowProps): Workflow {
    return new Workflow(props);
  }

  get id(): string {
    return this.props.workflowId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get branchId(): string | null {
    return this.props.branchId ?? null;
  }

  get nameEn(): string {
    return this.props.nameEn;
  }

  get nameAr(): string {
    return this.props.nameAr;
  }

  get descriptionEn(): string {
    return this.props.descriptionEn;
  }

  get descriptionAr(): string {
    return this.props.descriptionAr;
  }

  get steps(): string[] {
    return [...this.props.steps];
  }

  get currentStepIndex(): number {
    return this.props.currentStepIndex;
  }

  get currentStep(): string {
    return this.props.steps[this.props.currentStepIndex];
  }

  get status(): WorkflowStatusVO {
    return this.props.status;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get canceledBy(): string | null {
    return this.props.canceledBy ?? null;
  }

  get canceledAt(): Date | null {
    return this.props.canceledAt ?? null;
  }

  get cancelReason(): string | null {
    return this.props.cancelReason ?? null;
  }

  advance(actionedBy: string, comment?: string | null): void {
    if (!actionedBy?.trim()) {
      throw new WorkflowDomainError('ActionedBy is required to advance a workflow');
    }
    if (this.props.status.value === 'canceled') {
      throw new WorkflowDomainError('Canceled workflows cannot be advanced');
    }
    if (this.props.status.value === 'completed') {
      throw new WorkflowDomainError('Completed workflows cannot be advanced');
    }
    if (this.props.currentStepIndex >= this.props.steps.length - 1) {
      this.props.status = new WorkflowStatusVO('completed');
      this.props.updatedAt = new Date();
      return;
    }

    this.props.currentStepIndex += 1;
    if (this.props.currentStepIndex >= this.props.steps.length - 1) {
      this.props.status = new WorkflowStatusVO('completed');
    }
    this.props.updatedAt = new Date();
  }

  cancel(canceledBy: string, reason?: string | null): void {
    if (!canceledBy?.trim()) {
      throw new WorkflowDomainError('CanceledBy is required to cancel a workflow');
    }
    if (this.props.status.value === 'canceled') {
      throw new WorkflowDomainError('Workflow is already canceled');
    }
    if (this.props.status.value === 'completed') {
      throw new WorkflowDomainError('Completed workflows cannot be canceled');
    }

    this.props.status = new WorkflowStatusVO('canceled');
    this.props.canceledBy = canceledBy.trim();
    this.props.cancelReason = reason?.trim() ?? null;
    this.props.canceledAt = new Date();
    this.props.updatedAt = new Date();
  }

  toPrimitives() {
    return {
      workflowId: this.props.workflowId,
      tenantId: this.props.tenantId,
      branchId: this.props.branchId,
      nameEn: this.props.nameEn,
      nameAr: this.props.nameAr,
      descriptionEn: this.props.descriptionEn,
      descriptionAr: this.props.descriptionAr,
      steps: [...this.props.steps],
      currentStepIndex: this.props.currentStepIndex,
      status: this.props.status.value,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      canceledBy: this.props.canceledBy,
      canceledAt: this.props.canceledAt?.toISOString() ?? null,
      cancelReason: this.props.cancelReason,
    };
  }
}
