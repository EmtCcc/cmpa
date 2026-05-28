import { ipcMain, type BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../../shared/constants.js";
import { AgentRuntime, type SpawnRequest, ALLOWED_EXECUTABLES } from "../../agent-runtime.js";
import type { AgentRepository } from "../../../db/index.js";
import type { HealthCheckResult } from "../../../shared/types.js";

/**
 * Agent IPC Controller — exposes agent spawn/manage via IPC only.
 *
 * H4 fix: agents:spawn is restricted to IPC (context-isolated preload bridge),
 * NOT exposed via HTTP API. All spawn attempts go through the allowlist
 * in AgentRuntime and are logged with full args.
 *
 * Channel naming: `runtime:agents:*` for process management,
 * distinct from `agents:*` which is DB entity CRUD.
 */

export function registerAgentController(
  runtime: AgentRuntime,
  agentRepo: AgentRepository,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(IPC_CHANNELS.RUNTIME_AGENTS_SPAWN, (_event, request: SpawnRequest) => {
    return runtime.spawn(request);
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_AGENTS_LIST, () => {
    return runtime.list();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_AGENTS_TERMINATE, (_event, processId: string) => {
    return { ok: runtime.terminate(processId) };
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_AGENTS_TERMINATE_ALL, () => {
    runtime.terminateAll();
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_AGENTS_ALLOWED, () => {
    return [...ALLOWED_EXECUTABLES];
  });

  // Agent Health Check
  ipcMain.handle(IPC_CHANNELS.AGENT_HEALTH_CHECK, async (_event, agentId: string): Promise<HealthCheckResult> => {
    const agent = agentRepo.getById(agentId);
    if (!agent?.executable_path) {
      return { agentId, status: "error", error: "Agent not found or has no executable path", checkedAt: new Date().toISOString() };
    }
    const result = await runtime.healthCheck(agentId, agent.executable_path);
    getMainWindow()?.webContents.send(IPC_CHANNELS.AGENT_STATUS_CHANGED, result);
    return result;
  });
}
