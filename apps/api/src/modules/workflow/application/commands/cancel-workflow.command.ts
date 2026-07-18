export class CancelWorkflowCommand {
  constructor(public readonly workflowId: string, public readonly canceledBy: string, public readonly reason: string | null) {}
}
