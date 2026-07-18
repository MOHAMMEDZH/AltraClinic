export class AdvanceWorkflowCommand {
  constructor(public readonly workflowId: string, public readonly actionedBy: string, public readonly comment: string | null) {}
}
