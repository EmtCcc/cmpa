// Canonical domain types shared between main and renderer processes.
// Database entity types mirror the schema; runtime types match the agent runtime.

// ── Agent Type Enum ─────────────────────────────────────────────────

export const AGENT_TYPES = [
  "claude-code",
  "codex",
  "gemini-cli",
  "opencode",
  "custom",
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

// ── Database Entities ────────────────────────────────────────────────

export interface Agent {
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

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  goal_id: string;
  agent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  output: string | null;
  depends_on: string; // JSON array of task IDs
  createdAt: string;
  updatedAt: string;
}

export interface TaskHandoff {
  id: string;
  source_task_id: string;
  target_task_id: string;
  output_snapshot: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  level: string;
  message: string;
  metadata: string;
  createdAt: string;
}

// ── Input types for create/update operations ─────────────────────────

export interface CreateAgentInput {
  name: string;
  role: string;
  status?: string;
  config?: string;
  executable_path?: string;
  working_directory?: string;
  agent_type?: AgentType;
  config_json?: string;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  status?: string;
  config?: string;
  executable_path?: string | null;
  working_directory?: string | null;
  agent_type?: AgentType;
  config_json?: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  status?: string;
  priority?: number;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
}

export interface CreateTaskInput {
  goal_id: string;
  agent_id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  output?: string;
  depends_on?: string[];
}

export interface UpdateTaskInput {
  goal_id?: string;
  agent_id?: string | null;
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  output?: string;
  depends_on?: string[];
}

export interface CreateTaskLogInput {
  task_id: string;
  level?: string;
  message: string;
  metadata?: string;
}

export interface CreateHandoffInput {
  source_task_id: string;
  target_task_id: string;
  output_snapshot?: string;
}

// ── Auth types ───────────────────────────────────────────────────────

export interface Session {
  token: string;
  role: "admin" | "user";
  createdAt: number;
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  role?: "admin" | "user";
  error?: string;
}

export interface AuthStatus {
  configured: boolean;
}

// ── Agent Runtime types ──────────────────────────────────────────────

export interface SpawnRequest {
  executable: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SpawnResult {
  ok: boolean;
  processId?: string;
  pid?: number;
  error?: string;
}

export interface ManagedProcessInfo {
  id: string;
  executable: string;
  args: string[];
  startedAt: string;
  pid?: number;
}

export interface HealthCheckResult {
  agentId: string;
  status: "idle" | "offline" | "error";
  version?: string;
  error?: string;
  checkedAt: string;
}

// ── Orchestration types ──────────────────────────────────────────────

import type { OrchestrationState } from "./constants.js";

/** An orchestration task — wraps a task with orchestration lifecycle. */
export interface OrchestrationTask {
  id: string;
  taskId: string; // FK to tasks table
  agentId: string | null; // assigned agent (null until ASSIGNED)
  state: OrchestrationState;
  priority: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  retryCount: number;
  output: string | null;
}

/** Input to enqueue a new orchestration task. */
export interface EnqueueTaskInput {
  taskId: string;
  priority?: number;
}

/** Snapshot of the orchestrator's current state. */
export interface OrchestratorStatus {
  queueDepth: number;
  runningCount: number;
  maxParallel: number;
  tasks: OrchestrationTask[];
}

/** Event emitted on orchestration task state changes. */
export interface OrchestrationStateChangeEvent {
  taskId: string;
  oldState: OrchestrationState;
  newState: OrchestrationState;
  agentId: string | null;
  error?: string;
}

// ── Cron Schedule types ──────────────────────────────────────────────

export interface CronSchedule {
  id: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  template_goal_id: string | null;
  template_agent_id: string | null;
  template_title: string;
  template_description: string | null;
  template_priority: number;
  last_triggered_at: string | null;
  next_trigger_at: string | null;
  trigger_count: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCronScheduleInput {
  name: string;
  cron_expression: string;
  enabled?: boolean;
  template_goal_id?: string;
  template_agent_id?: string;
  template_title: string;
  template_description?: string;
  template_priority?: number;
}

export interface UpdateCronScheduleInput {
  name?: string;
  cron_expression?: string;
  enabled?: boolean;
  template_goal_id?: string | null;
  template_agent_id?: string | null;
  template_title?: string;
  template_description?: string | null;
  template_priority?: number;
}

export interface CronTriggerEvent {
  scheduleId: string;
  scheduleName: string;
  taskId: string;
  triggeredAt: string;
  cronExpression: string;
}

export interface CronLogEntry {
  scheduleId: string;
  scheduleName: string;
  cronExpression: string;
  triggeredAt: string;
  taskId: string | null;
  success: boolean;
  error?: string;
}

// ── Workflow types ───────────────────────────────────────────────────

/** Serialized node position on the workflow canvas. */
export interface WorkflowNodePosition {
  x: number;
  y: number;
}

/** A single node in a workflow definition (agent step). */
export interface WorkflowNode {
  id: string;
  type: "agent";
  position: WorkflowNodePosition;
  data: {
    agentId: string | null;
    label: string;
    description?: string;
  };
}

/** A single edge connecting two workflow nodes. */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/** The full JSON definition of a workflow (stored as TEXT in DB). */
export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/** Database entity for a saved workflow. */
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  definition: string; // JSON-serialized WorkflowDefinition
  is_template: number; // 0 or 1 (SQLite boolean)
  built_in: number; // 0 or 1 — true for migration-seeded templates
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  is_template?: boolean;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
  is_template?: boolean;
}

/** Result of materializing a workflow into tasks. */
export interface WorkflowExecutionResult {
  workflowId: string;
  taskIds: string[];
  goalId: string | null;
}

// ── Analytics types ──────────────────────────────────────────────────

export interface AnalyticsConfig {
  apiKey: string;
  host: string;
  optOut: boolean;
  debug: boolean;
  distinctId: string;
  isInternal: boolean;
}
