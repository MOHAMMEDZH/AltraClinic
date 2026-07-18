import { WorkflowPipelineDiagram } from './enterprise/WorkflowPipelineDiagram';

export function WorkflowStepProgress({
  steps,
  currentStepIndex,
  status,
}: {
  steps: string[];
  currentStepIndex: number;
  status: string;
}) {
  return <WorkflowPipelineDiagram steps={steps} currentStepIndex={currentStepIndex} status={status} />;
}
