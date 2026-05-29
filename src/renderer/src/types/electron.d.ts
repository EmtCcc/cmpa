/** Type declarations for the Electron preload API exposed to the renderer. */

interface WorkflowNodePosition {
  x: number;
  y: number;
}

interface WorkflowNode {
  id: string;
  type: "agent";
  position: WorkflowNodePosition;
  data: {
    agentId: string | null;
    label: string;
    description?: string;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  definition: string;
  is_template: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  is_template?: boolean;
}

interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
  is_template?: boolean;
}

interface WorkflowExecutionResult {
  workflowId: string;
  taskIds: string[];
  goalId: string | null;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  config: string;
  executable_path: string | null;
  working_directory: string | null;
  agent_type: string;
  config_json: string;
  createdAt: string;
  updatedAt: string;
}

interface IpcOk<T> {
  ok: true;
  data: T;
}

interface IpcErr {
  ok: false;
  error: string;
}

type IpcResult<T> = IpcOk<T> | IpcErr;

interface ElectronAPI {
  // Workflows
  listWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(input: CreateWorkflowInput): Promise<IpcResult<Workflow>>;
  updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<IpcResult<Workflow>>;
  deleteWorkflow(id: string): Promise<IpcResult<boolean>>;
  executeWorkflow(workflowId: string, goalId?: string): Promise<IpcResult<WorkflowExecutionResult>>;

  // Agents
  listAgents(): Promise<Agent[]>;

  // App
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
}

declare interface Window {
  electronAPI: ElectronAPI;
}
