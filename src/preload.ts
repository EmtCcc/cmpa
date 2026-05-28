import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./shared/constants.js";
import type { ElectronAPI } from "./shared/ipc-contracts.js";

const electronAPI: ElectronAPI = {
  // App
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.APP_PLATFORM),

  // Navigation
  onNavigate: (callback: (route: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, route: string) => callback(route);
    ipcRenderer.on(IPC_CHANNELS.NAVIGATE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.NAVIGATE, handler);
    };
  },

  // Auth
  getAuthStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),
  login: (secret) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, secret),
  logout: (token) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT, token),

  // Agent Runtime (process management)
  listRuntimeAgents: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_AGENTS_LIST),
  spawnAgent: (request) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_AGENTS_SPAWN, request),
  terminateAgent: (processId) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_AGENTS_TERMINATE, processId),
  terminateAllAgents: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_AGENTS_TERMINATE_ALL),
  getAllowedExecutables: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_AGENTS_ALLOWED),

  // Agent Health
  checkAgentHealth: (agentId) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_HEALTH_CHECK, agentId),
  onAgentStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: import("./shared/types.js").HealthCheckResult) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.AGENT_STATUS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STATUS_CHANGED, handler);
    };
  },

  // DB Agents (entity CRUD)
  listAgents: () => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_LIST),
  getAgent: (id) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_GET, id),
  createAgent: (input) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_CREATE, input),
  updateAgent: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_UPDATE, id, input),
  deleteAgent: (id) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS_DELETE, id),

  // Goals
  listGoals: () => ipcRenderer.invoke(IPC_CHANNELS.GOALS_LIST),
  getGoal: (id) => ipcRenderer.invoke(IPC_CHANNELS.GOALS_GET, id),
  createGoal: (input) => ipcRenderer.invoke(IPC_CHANNELS.GOALS_CREATE, input),
  updateGoal: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.GOALS_UPDATE, id, input),
  deleteGoal: (id) => ipcRenderer.invoke(IPC_CHANNELS.GOALS_DELETE, id),

  // Tasks (authenticated — token required)
  listTasks: (token) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_LIST, token),
  getTask: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET, id),
  createTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_CREATE, input),
  updateTask: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_UPDATE, id, input),
  deleteTask: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_DELETE, id),
  moveTask: (token, taskId, newStatus) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_MOVE, token, taskId, newStatus),

  // Task Logs
  listTaskLogs: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.TASK_LOGS_LIST, taskId),
  createTaskLog: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASK_LOGS_CREATE, input),

  // Task Output & Handoff
  getTaskOutput: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET_OUTPUT, taskId),
  setTaskDependencies: (taskId, dependsOn) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_SET_DEPENDENCIES, taskId, dependsOn),
  listHandoffsBySource: (sourceTaskId) => ipcRenderer.invoke(IPC_CHANNELS.TASK_HANDOFFS_LIST_BY_SOURCE, sourceTaskId),
  listHandoffsByTarget: (targetTaskId) => ipcRenderer.invoke(IPC_CHANNELS.TASK_HANDOFFS_LIST_BY_TARGET, targetTaskId),

  // Orchestration
  enqueueTask: (input) => ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_ENQUEUE, input),
  cancelOrchestrationTask: (id) => ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_CANCEL, id),
  getOrchestratorStatus: () => ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_STATUS),
  setMaxParallel: (max) => ipcRenderer.invoke(IPC_CHANNELS.ORCHESTRATION_SET_MAX_PARALLEL, max),
  onOrchestrationStateChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: import("./shared/types.js").OrchestrationStateChangeEvent) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.ORCHESTRATION_STATE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ORCHESTRATION_STATE_CHANGED, handler);
    };
  },

  // Cron Schedules
  listCronSchedules: () => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_LIST),
  getCronSchedule: (id) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_GET, id),
  createCronSchedule: (input) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_CREATE, input),
  updateCronSchedule: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_UPDATE, id, input),
  deleteCronSchedule: (id) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_DELETE, id),
  triggerCronSchedule: (id) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_TRIGGER, id),
  getCronScheduleLogs: (limit) => ipcRenderer.invoke(IPC_CHANNELS.CRON_SCHEDULES_LOGS, limit),
  onCronScheduleTriggered: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, result: import("./shared/types.js").CronTriggerEvent) => callback(result);
    ipcRenderer.on(IPC_CHANNELS.CRON_SCHEDULES_TRIGGERED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CRON_SCHEDULES_TRIGGERED, handler);
    };
  },

  // Analytics
  getAnalyticsConfig: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_CONFIG),
  track: (event, properties) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_TRACK, event, properties),
  identify: (distinctId, properties) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_IDENTIFY, distinctId, properties),
  analyticsOptOut: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_OPT_OUT),
  analyticsOptIn: () => ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_OPT_IN),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Backward compatibility — renderer code using window.app keeps working
contextBridge.exposeInMainWorld("app", {
  getVersion: electronAPI.getVersion,
  getPlatform: electronAPI.getPlatform,
  onNavigate: electronAPI.onNavigate,
  auth: {
    status: electronAPI.getAuthStatus,
    login: electronAPI.login,
    logout: electronAPI.logout,
  },
  tasks: {
    list: (token: string) => electronAPI.listTasks(token),
    move: (token: string, taskId: string, newStatus: string) => electronAPI.moveTask(token, taskId, newStatus),
    update: (id: string, input: Record<string, unknown>) => electronAPI.updateTask(id, input),
  },
  analytics: {
    config: electronAPI.getAnalyticsConfig,
    track: electronAPI.track,
    identify: electronAPI.identify,
    optOut: electronAPI.analyticsOptOut,
    optIn: electronAPI.analyticsOptIn,
  },
});

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
