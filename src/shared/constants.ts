// IPC channel names, status enums, and default values.

// --- Agent Types ---
// Allowed agent types for the agent registry.

export const AGENT_TYPE = {
  CLAUDE_CODE: "claude-code",
  CODEX: "codex",
  GEMINI_CLI: "gemini-cli",
  OPENCODE: "opencode",
  CUSTOM: "custom",
} as const;

export type AgentTypeValue = (typeof AGENT_TYPE)[keyof typeof AGENT_TYPE];

// --- IPC Channel Names ---
// Use `as const` so channel strings are literal types, not widened to `string`.

export const IPC_CHANNELS = {
  // App
  APP_VERSION: "app:version",
  APP_PLATFORM: "app:platform",
  // Navigation (main → renderer push)
  NAVIGATE: "navigate",

  // Auth
  AUTH_STATUS: "auth:status",
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",

  // Agent Runtime (process management)
  RUNTIME_AGENTS_LIST: "runtime:agents:list",
  RUNTIME_AGENTS_SPAWN: "runtime:agents:spawn",
  RUNTIME_AGENTS_TERMINATE: "runtime:agents:terminate",
  RUNTIME_AGENTS_TERMINATE_ALL: "runtime:agents:terminateAll",
  RUNTIME_AGENTS_ALLOWED: "runtime:agents:allowedExecutables",

  // Agent Health
  AGENT_HEALTH_CHECK: "agent:health-check",

  // Agent Status (main → renderer push)
  AGENT_STATUS_CHANGED: "agent:status",

  // DB Agents (entity CRUD)
  AGENTS_LIST: "agents:list",
  AGENTS_GET: "agents:get",
  AGENTS_CREATE: "agents:create",
  AGENTS_UPDATE: "agents:update",
  AGENTS_DELETE: "agents:delete",

  // Goals
  GOALS_LIST: "goals:list",
  GOALS_GET: "goals:get",
  GOALS_CREATE: "goals:create",
  GOALS_UPDATE: "goals:update",
  GOALS_DELETE: "goals:delete",

  // Tasks
  TASKS_LIST: "tasks:list",
  TASKS_GET: "tasks:get",
  TASKS_CREATE: "tasks:create",
  TASKS_UPDATE: "tasks:update",
  TASKS_DELETE: "tasks:delete",
  TASKS_MOVE: "tasks:move",

  // Task Logs
  TASK_LOGS_LIST: "task-logs:list",
  TASK_LOGS_CREATE: "task-logs:create",

  // Task Output & Handoff
  TASKS_GET_OUTPUT: "tasks:getOutput",
  TASKS_SET_DEPENDENCIES: "tasks:setDependencies",
  TASK_HANDOFFS_LIST_BY_SOURCE: "task-handoffs:listBySource",
  TASK_HANDOFFS_LIST_BY_TARGET: "task-handoffs:listByTarget",

  // Orchestration
  ORCHESTRATION_ENQUEUE: "orchestration:enqueue",
  ORCHESTRATION_CANCEL: "orchestration:cancel",
  ORCHESTRATION_STATUS: "orchestration:status",
  ORCHESTRATION_SET_MAX_PARALLEL: "orchestration:setMaxParallel",
  ORCHESTRATION_STATE_CHANGED: "orchestration:stateChanged",

  // Cron Schedules
  CRON_SCHEDULES_LIST: "cron-schedules:list",
  CRON_SCHEDULES_GET: "cron-schedules:get",
  CRON_SCHEDULES_CREATE: "cron-schedules:create",
  CRON_SCHEDULES_UPDATE: "cron-schedules:update",
  CRON_SCHEDULES_DELETE: "cron-schedules:delete",
  CRON_SCHEDULES_TRIGGER: "cron-schedules:trigger",
  CRON_SCHEDULES_LOGS: "cron-schedules:logs",
  CRON_SCHEDULES_TRIGGERED: "cron-schedules:triggered",

  // Workflows
  WORKFLOWS_LIST: "workflows:list",
  WORKFLOWS_GET: "workflows:get",
  WORKFLOWS_CREATE: "workflows:create",
  WORKFLOWS_UPDATE: "workflows:update",
  WORKFLOWS_DELETE: "workflows:delete",
  WORKFLOWS_EXECUTE: "workflows:execute",

  // Workflow Templates
  WORKFLOW_TEMPLATES_LIST: "workflow-templates:list",
  WORKFLOW_TEMPLATES_GET: "workflow-templates:get",
  WORKFLOW_TEMPLATES_INSTANTIATE: "workflow-templates:instantiate",
  WORKFLOW_TEMPLATES_SAVE: "workflow-templates:save",

  // Analytics
  ANALYTICS_CONFIG: "analytics:config",
  ANALYTICS_TRACK: "analytics:track",
  ANALYTICS_IDENTIFY: "analytics:identify",
  ANALYTICS_OPT_OUT: "analytics:optOut",
  ANALYTICS_OPT_IN: "analytics:optIn",
} as const;

// --- Status Enums ---

export const TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// Sub-states for in_progress tasks — shows granular progress.
export const TASK_SUB_STATE = {
  QUEUED: "queued",
  INITIALIZING: "initializing",
  EXECUTING: "executing",
  SUMMARIZING: "summarizing",
} as const;

export type TaskSubState = (typeof TASK_SUB_STATE)[keyof typeof TASK_SUB_STATE];

// Ordered list for stepper rendering.
export const TASK_SUB_STATE_ORDER: TaskSubState[] = [
  TASK_SUB_STATE.QUEUED,
  TASK_SUB_STATE.INITIALIZING,
  TASK_SUB_STATE.EXECUTING,
  TASK_SUB_STATE.SUMMARIZING,
];

export const GOAL_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type GoalStatus = (typeof GOAL_STATUS)[keyof typeof GOAL_STATUS];

export const AGENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  IDLE: "idle",
  OFFLINE: "offline",
  ERROR: "error",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

// --- Orchestration Task States ---

export const ORCHESTRATION_STATE = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type OrchestrationState = (typeof ORCHESTRATION_STATE)[keyof typeof ORCHESTRATION_STATE];

export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

// --- Priority ---

export const PRIORITY = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// --- Defaults ---

export const DEFAULTS = {
  TASK_STATUS: TASK_STATUS.PENDING,
  GOAL_STATUS: GOAL_STATUS.ACTIVE,
  AGENT_STATUS: AGENT_STATUS.ACTIVE,
  LOG_LEVEL: LOG_LEVEL.INFO,
  PRIORITY: PRIORITY.MEDIUM,
  CONFIG: "{}",
  METADATA: "{}",
} as const;
