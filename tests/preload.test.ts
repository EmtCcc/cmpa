import { describe, it, expect } from "vitest";
import type { ElectronAPI } from "../src/shared/ipc-contracts.js";

describe("ElectronAPI type contract", () => {
  it("defines getVersion returning Promise<string>", async () => {
    const api = mockAPI({ getVersion: async () => "0.1.0" });
    expect(typeof api.getVersion).toBe("function");
    expect(await api.getVersion()).toBe("0.1.0");
  });

  it("defines getPlatform returning Promise<string>", async () => {
    const api = mockAPI({ getPlatform: async () => "darwin" });
    expect(await api.getPlatform()).toBe("darwin");
  });

  it("onNavigate returns an unsubscribe function", () => {
    const api = mockAPI({
      onNavigate: (cb) => {
        cb("test");
        return () => {};
      },
    });
    const unsub = api.onNavigate(() => {});
    expect(typeof unsub).toBe("function");
  });

  it("auth methods exist with correct signatures", async () => {
    const api = mockAPI({
      getAuthStatus: async () => ({ configured: true }),
      login: async () => ({ ok: true, token: "abc", role: "user" }),
      logout: async () => ({ ok: true }),
    });
    expect(await api.getAuthStatus()).toEqual({ configured: true });
    expect((await api.login("secret")).ok).toBe(true);
    expect((await api.logout("token")).ok).toBe(true);
  });

  it("DB entity CRUD methods exist with correct signatures", async () => {
    const api = mockAPI({
      listAgents: async () => [],
      getAgent: async () => undefined,
      createAgent: async () => ({ ok: true, data: agentFixture() }),
      updateAgent: async () => ({ ok: true, data: agentFixture() }),
      deleteAgent: async () => ({ ok: true, data: true }),
    });
    expect(await api.listAgents()).toEqual([]);
    expect(await api.getAgent("x")).toBeUndefined();
    expect((await api.createAgent({ name: "A", role: "dev" })).ok).toBe(true);
    expect((await api.updateAgent("x", { name: "B" })).ok).toBe(true);
    expect((await api.deleteAgent("x")).ok).toBe(true);
  });

  it("task methods return correct types", async () => {
    const api = mockAPI({
      listTasks: async () => [taskFixture()],
      moveTask: async () => ({ ok: true, data: taskFixture() }),
    });
    const tasks = await api.listTasks("session-token");
    expect(tasks[0].goal_id).toBeDefined();
    expect(tasks[0].priority).toBe(0);
    expect((await api.moveTask("session-token", "t1", "done")).ok).toBe(true);
  });

  it("runtime agent methods exist with correct signatures", async () => {
    const api = mockAPI({
      listRuntimeAgents: async () => [],
      spawnAgent: async () => ({ ok: true, processId: "p1", pid: 123 }),
      terminateAgent: async () => ({ ok: true }),
      terminateAllAgents: async () => ({ ok: true }),
      getAllowedExecutables: async () => ["claude", "node"],
    });
    expect(await api.listRuntimeAgents()).toEqual([]);
    expect((await api.spawnAgent({ executable: "claude" })).ok).toBe(true);
    expect((await api.terminateAgent("p1")).ok).toBe(true);
    expect((await api.terminateAllAgents()).ok).toBe(true);
    expect(await api.getAllowedExecutables()).toContain("claude");
  });

  it("goal methods exist with correct signatures", async () => {
    const api = mockAPI({
      listGoals: async () => [],
      getGoal: async () => undefined,
      createGoal: async () => ({ ok: true, data: { id: "g1", title: "G", description: null, status: "active", priority: 0, createdAt: "", updatedAt: "" } }),
    });
    expect(await api.listGoals()).toEqual([]);
    expect(await api.getGoal("x")).toBeUndefined();
    expect((await api.createGoal({ title: "G" })).ok).toBe(true);
  });

  it("task log methods exist with correct signatures", async () => {
    const api = mockAPI({
      listTaskLogs: async () => [],
      createTaskLog: async () => ({ ok: true, data: { id: "l1", task_id: "t1", level: "info", message: "m", metadata: "{}", createdAt: "" } }),
    });
    expect(await api.listTaskLogs("t1")).toEqual([]);
    expect((await api.createTaskLog({ task_id: "t1", message: "m" })).ok).toBe(true);
  });

  it("analytics methods exist with correct signatures", async () => {
    const api = mockAPI({
      getAnalyticsConfig: async () => null,
      track: async () => ({ ok: true }),
      identify: async () => ({ ok: true }),
      analyticsOptOut: async () => ({ ok: true }),
      analyticsOptIn: async () => ({ ok: true }),
    });
    expect(await api.getAnalyticsConfig()).toBeNull();
    expect((await api.track("event")).ok).toBe(true);
    expect((await api.identify("id")).ok).toBe(true);
    expect((await api.analyticsOptOut()).ok).toBe(true);
    expect((await api.analyticsOptIn()).ok).toBe(true);
  });
});

// --- Fixtures ---

function agentFixture() {
  return { id: "a1", name: "Agent", role: "dev", status: "active", config: "{}", createdAt: "", updatedAt: "" };
}

function taskFixture() {
  return { id: "t1", goal_id: "g1", agent_id: null, title: "T", description: null, status: "pending", priority: 0, createdAt: "", updatedAt: "" };
}

/**
 * Build a mock ElectronAPI with sensible defaults for all methods.
 * Only the methods you pass are overridden; the rest return safe no-ops.
 */
function mockAPI(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const noop = async () => {};
  return {
    getVersion: async () => "0.0.0",
    getPlatform: async () => "darwin",
    onNavigate: () => () => {},
    getAuthStatus: async () => ({ configured: false }),
    login: async () => ({ ok: false }),
    logout: async () => ({ ok: false }),
    listRuntimeAgents: async () => [],
    spawnAgent: async () => ({ ok: false }),
    terminateAgent: async () => ({ ok: false }),
    terminateAllAgents: async () => ({ ok: false }),
    getAllowedExecutables: async () => [],
    listAgents: async () => [],
    getAgent: async () => undefined,
    createAgent: async () => ({ ok: false, error: "mock" }),
    updateAgent: async () => ({ ok: false, error: "mock" }),
    deleteAgent: async () => ({ ok: false, error: "mock" }),
    listGoals: async () => [],
    getGoal: async () => undefined,
    createGoal: async () => ({ ok: false, error: "mock" }),
    updateGoal: async () => ({ ok: false, error: "mock" }),
    deleteGoal: async () => ({ ok: false, error: "mock" }),
    listTasks: async () => [],
    getTask: async () => undefined,
    createTask: async () => ({ ok: false, error: "mock" }),
    updateTask: async () => ({ ok: false, error: "mock" }),
    deleteTask: async () => ({ ok: false, error: "mock" }),
    moveTask: async () => ({ ok: false, error: "mock" }),
    listTaskLogs: async () => [],
    createTaskLog: async () => ({ ok: false, error: "mock" }),
    getAnalyticsConfig: async () => null,
    track: async () => ({ ok: false }),
    identify: async () => ({ ok: false }),
    analyticsOptOut: async () => ({ ok: false }),
    analyticsOptIn: async () => ({ ok: false }),
    ...overrides,
  } as ElectronAPI;
}
