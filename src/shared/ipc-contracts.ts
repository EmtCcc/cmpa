// Type-safe IPC contract between main and renderer processes.
//
// Each channel maps to { request, response } types.
// Main process handlers and renderer invoke calls both derive
// their signatures from this single map — a mismatch is a compile error.

import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskLog,
  CreateTaskLogInput,
  TaskHandoff,
  CreateHandoffInput,
  AuthStatus,
  LoginResult,
  SpawnRequest,
  SpawnResult,
  ManagedProcessInfo,
  AnalyticsConfig,
  HealthCheckResult,
  EnqueueTaskInput,
  OrchestratorStatus,
  OrchestrationTask,
  CronSchedule,
  CreateCronScheduleInput,
  UpdateCronScheduleInput,
  CronTriggerEvent,
  CronLogEntry,
  Workflow,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowExecutionResult,
} from "./types.js";

// --- Result wrapper for mutation operations ---

export interface IpcOk<T> {
  ok: true;
  data: T;
}

export interface IpcErr {
  ok: false;
  error: string;
}

export type IpcResult<T> = IpcOk<T> | IpcErr;

// --- Channel contract map ---
// Key = channel name literal, value = { request (args), response (return) }

export interface IpcRequestMap {
  // App
  "app:version": { request: []; response: string };
  "app:platform": { request: []; response: string };

  // Auth (public, no token required)
  "auth:status": { request: []; response: AuthStatus };
  "auth:login": { request: [secret: string]; response: LoginResult };
  "auth:logout": { request: [token: string]; response: { ok: boolean } };

  // Agent Runtime (process management)
  "runtime:agents:list": { request: []; response: ManagedProcessInfo[] };
  "runtime:agents:spawn": { request: [request: SpawnRequest]; response: SpawnResult };
  "runtime:agents:terminate": { request: [processId: string]; response: { ok: boolean } };
  "runtime:agents:terminateAll": { request: []; response: { ok: boolean } };
  "runtime:agents:allowedExecutables": { request: []; response: string[] };

  // Agent Health
  "agent:health-check": { request: [agentId: string]; response: HealthCheckResult };

  // DB Agents (entity CRUD)
  "agents:list": { request: []; response: Agent[] };
  "agents:get": { request: [id: string]; response: Agent | undefined };
  "agents:create": { request: [input: CreateAgentInput]; response: IpcResult<Agent> };
  "agents:update": { request: [id: string, input: UpdateAgentInput]; response: IpcResult<Agent> };
  "agents:delete": { request: [id: string]; response: IpcResult<boolean> };

  // Goals
  "goals:list": { request: []; response: Goal[] };
  "goals:get": { request: [id: string]; response: Goal | undefined };
  "goals:create": { request: [input: CreateGoalInput]; response: IpcResult<Goal> };
  "goals:update": { request: [id: string, input: UpdateGoalInput]; response: IpcResult<Goal> };
  "goals:delete": { request: [id: string]; response: IpcResult<boolean> };

  // Tasks
  "tasks:list": { request: [token: string]; response: Task[] };
  "tasks:get": { request: [id: string]; response: Task | undefined };
  "tasks:create": { request: [input: CreateTaskInput]; response: IpcResult<Task> };
  "tasks:update": { request: [id: string, input: UpdateTaskInput]; response: IpcResult<Task> };
  "tasks:delete": { request: [id: string]; response: IpcResult<boolean> };
  "tasks:move": { request: [token: string, taskId: string, newStatus: string]; response: IpcResult<Task> };

  // Task Logs
  "task-logs:list": { request: [taskId: string]; response: TaskLog[] };
  "task-logs:create": { request: [input: CreateTaskLogInput]; response: IpcResult<TaskLog> };

  // Task Output & Handoff
  "tasks:getOutput": { request: [taskId: string]; response: string | null };
  "tasks:setDependencies": { request: [taskId: string, dependsOn: string[]]; response: IpcResult<Task> };
  "task-handoffs:listBySource": { request: [sourceTaskId: string]; response: TaskHandoff[] };
  "task-handoffs:listByTarget": { request: [targetTaskId: string]; response: TaskHandoff[] };

  // Orchestration
  "orchestration:enqueue": { request: [input: EnqueueTaskInput]; response: IpcResult<OrchestrationTask> };
  "orchestration:cancel": { request: [orchestrationTaskId: string]; response: IpcResult<boolean> };
  "orchestration:status": { request: []; response: OrchestratorStatus };
  "orchestration:setMaxParallel": { request: [max: number]; response: { ok: boolean } };

  // Cron Schedules
  "cron-schedules:list": { request: []; response: CronSchedule[] };
  "cron-schedules:get": { request: [id: string]; response: CronSchedule | undefined };
  "cron-schedules:create": { request: [input: CreateCronScheduleInput]; response: IpcResult<CronSchedule> };
  "cron-schedules:update": { request: [id: string, input: UpdateCronScheduleInput]; response: IpcResult<CronSchedule> };
  "cron-schedules:delete": { request: [id: string]; response: IpcResult<boolean> };
  "cron-schedules:trigger": { request: [id: string]; response: IpcResult<CronTriggerEvent> };
  "cron-schedules:logs": { request: [limit?: number]; response: CronLogEntry[] };

  // Workflows
  "workflows:list": { request: []; response: Workflow[] };
  "workflows:get": { request: [id: string]; response: Workflow | undefined };
  "workflows:create": { request: [input: CreateWorkflowInput]; response: IpcResult<Workflow> };
  "workflows:update": { request: [id: string, input: UpdateWorkflowInput]; response: IpcResult<Workflow> };
  "workflows:delete": { request: [id: string]; response: IpcResult<boolean> };
  "workflows:execute": { request: [workflowId: string, goalId?: string]; response: IpcResult<WorkflowExecutionResult> };

  // Workflow Templates
  "workflow-templates:list": { request: []; response: { builtIn: Workflow[]; userTemplates: Workflow[] } };
  "workflow-templates:get": { request: [id: string]; response: Workflow | undefined };
  "workflow-templates:instantiate": { request: [templateId: string, overrides?: { name?: string; description?: string }]; response: IpcResult<Workflow> };
  "workflow-templates:save": { request: [workflowId: string, overrides?: { name?: string; description?: string }]; response: IpcResult<Workflow> };

  // Analytics
  "analytics:config": { request: []; response: AnalyticsConfig | null };
  "analytics:track": { request: [event: string, properties?: Record<string, unknown>]; response: { ok: boolean } };
  "analytics:identify": { request: [distinctId: string, properties?: Record<string, unknown>]; response: { ok: boolean } };
  "analytics:optOut": { request: []; response: { ok: boolean } };
  "analytics:optIn": { request: []; response: { ok: boolean } };
}

// --- Helper types for deriving handler/invoke signatures ---

/** Extract the request args tuple for a channel. */
export type IpcRequest<C extends keyof IpcRequestMap> = IpcRequestMap[C]["request"];

/** Extract the response type for a channel. */
export type IpcResponse<C extends keyof IpcRequestMap> = IpcRequestMap[C]["response"];

/** Main-process handler signature for a given channel. */
export type IpcHandler<C extends keyof IpcRequestMap> = (
  ...args: IpcRequest<C>
) => IpcResponse<C> | Promise<IpcResponse<C>>;

/** All channel names as a union type. */
export type IpcChannel = keyof IpcRequestMap;

/**
 * Type-safe IPC API exposed to the renderer via contextBridge.
 * Each method corresponds to one IPC channel.
 */
export interface ElectronAPI {
  // App
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;

  // Navigation (main → renderer push)
  onNavigate(callback: (route: string) => void): () => void;

  // Auth
  getAuthStatus(): Promise<AuthStatus>;
  login(secret: string): Promise<LoginResult>;
  logout(token: string): Promise<{ ok: boolean }>;

  // Agent Runtime (process management)
  listRuntimeAgents(): Promise<ManagedProcessInfo[]>;
  spawnAgent(request: SpawnRequest): Promise<SpawnResult>;
  terminateAgent(processId: string): Promise<{ ok: boolean }>;
  terminateAllAgents(): Promise<{ ok: boolean }>;
  getAllowedExecutables(): Promise<string[]>;

  // Agent Health
  checkAgentHealth(agentId: string): Promise<HealthCheckResult>;
  onAgentStatus(callback: (result: HealthCheckResult) => void): () => void;

  // DB Agents (entity CRUD)
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(input: CreateAgentInput): Promise<IpcResult<Agent>>;
  updateAgent(id: string, input: UpdateAgentInput): Promise<IpcResult<Agent>>;
  deleteAgent(id: string): Promise<IpcResult<boolean>>;

  // Goals
  listGoals(): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | undefined>;
  createGoal(input: CreateGoalInput): Promise<IpcResult<Goal>>;
  updateGoal(id: string, input: UpdateGoalInput): Promise<IpcResult<Goal>>;
  deleteGoal(id: string): Promise<IpcResult<boolean>>;

  // Tasks (authenticated)
  listTasks(token: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(input: CreateTaskInput): Promise<IpcResult<Task>>;
  updateTask(id: string, input: UpdateTaskInput): Promise<IpcResult<Task>>;
  deleteTask(id: string): Promise<IpcResult<boolean>>;
  moveTask(token: string, taskId: string, newStatus: string): Promise<IpcResult<Task>>;

  // Task Logs
  listTaskLogs(taskId: string): Promise<TaskLog[]>;
  createTaskLog(input: CreateTaskLogInput): Promise<IpcResult<TaskLog>>;

  // Task Output & Handoff
  getTaskOutput(taskId: string): Promise<string | null>;
  setTaskDependencies(taskId: string, dependsOn: string[]): Promise<IpcResult<Task>>;
  listHandoffsBySource(sourceTaskId: string): Promise<TaskHandoff[]>;
  listHandoffsByTarget(targetTaskId: string): Promise<TaskHandoff[]>;

  // Orchestration
  enqueueTask(input: EnqueueTaskInput): Promise<IpcResult<OrchestrationTask>>;
  cancelOrchestrationTask(orchestrationTaskId: string): Promise<IpcResult<boolean>>;
  getOrchestratorStatus(): Promise<OrchestratorStatus>;
  setMaxParallel(max: number): Promise<{ ok: boolean }>;
  onOrchestrationStateChanged(callback: (event: import("./types.js").OrchestrationStateChangeEvent) => void): () => void;

  // Cron Schedules
  listCronSchedules(): Promise<CronSchedule[]>;
  getCronSchedule(id: string): Promise<CronSchedule | undefined>;
  createCronSchedule(input: CreateCronScheduleInput): Promise<IpcResult<CronSchedule>>;
  updateCronSchedule(id: string, input: UpdateCronScheduleInput): Promise<IpcResult<CronSchedule>>;
  deleteCronSchedule(id: string): Promise<IpcResult<boolean>>;
  triggerCronSchedule(id: string): Promise<IpcResult<CronTriggerEvent>>;
  getCronScheduleLogs(limit?: number): Promise<CronLogEntry[]>;
  onCronScheduleTriggered(callback: (event: CronTriggerEvent) => void): () => void;

  // Workflows
  listWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(input: CreateWorkflowInput): Promise<IpcResult<Workflow>>;
  updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<IpcResult<Workflow>>;
  deleteWorkflow(id: string): Promise<IpcResult<boolean>>;
  executeWorkflow(workflowId: string, goalId?: string): Promise<IpcResult<WorkflowExecutionResult>>;

  // Workflow Templates
  listWorkflowTemplates(): Promise<{ builtIn: Workflow[]; userTemplates: Workflow[] }>;
  getWorkflowTemplate(id: string): Promise<Workflow | undefined>;
  instantiateWorkflowTemplate(templateId: string, overrides?: { name?: string; description?: string }): Promise<IpcResult<Workflow>>;
  saveWorkflowAsTemplate(workflowId: string, overrides?: { name?: string; description?: string }): Promise<IpcResult<Workflow>>;

  // Analytics
  getAnalyticsConfig(): Promise<AnalyticsConfig | null>;
  track(event: string, properties?: Record<string, unknown>): Promise<{ ok: boolean }>;
  identify(distinctId: string, properties?: Record<string, unknown>): Promise<{ ok: boolean }>;
  analyticsOptOut(): Promise<{ ok: boolean }>;
  analyticsOptIn(): Promise<{ ok: boolean }>;
}
