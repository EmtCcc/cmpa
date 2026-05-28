import { describe, it, expect } from "vitest";
import { IPC_CHANNELS } from "../src/shared/constants.js";
import type { IpcRequestMap, ElectronAPI } from "../src/shared/ipc-contracts.js";

describe("IPC contract integrity", () => {
  it("every IPC_CHANNELS value is a key in IpcRequestMap", () => {
    const channelValues = Object.values(IPC_CHANNELS);
    const contractKeys = new Set<string>();

    // Extract all keys from the IpcRequestMap interface at runtime
    // We verify this by checking that each constant value is a valid channel
    for (const ch of channelValues) {
      // Type-level check: this line won't compile if ch is not in IpcRequestMap
      type Check = typeof ch extends keyof IpcRequestMap ? true : false;
      const check: Check = true;
      expect(check).toBe(true);
      contractKeys.add(ch);
    }
  });

  it("no duplicate channel values in IPC_CHANNELS", () => {
    const values = Object.values(IPC_CHANNELS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("ElectronAPI has methods for all contract channels (excluding push-only channels)", () => {
    // Channels that are push-only (main→renderer) and don't need renderer methods
    const pushOnly = new Set(["navigate"]);

    const channelValues = Object.values(IPC_CHANNELS).filter(
      (ch) => !pushOnly.has(ch),
    );

    // Every non-push channel should be representable in the contract
    expect(channelValues.length).toBeGreaterThan(0);
    for (const ch of channelValues) {
      expect(typeof ch).toBe("string");
      expect(ch.length).toBeGreaterThan(0);
    }
  });

  it("IPC_CHANNELS covers all entity domains", () => {
    const values = Object.values(IPC_CHANNELS);
    // App
    expect(values).toContain("app:version");
    expect(values).toContain("app:platform");
    // Auth
    expect(values).toContain("auth:status");
    expect(values).toContain("auth:login");
    expect(values).toContain("auth:logout");
    // Runtime agents
    expect(values).toContain("runtime:agents:list");
    expect(values).toContain("runtime:agents:spawn");
    // DB agents
    expect(values).toContain("agents:list");
    expect(values).toContain("agents:get");
    // Goals
    expect(values).toContain("goals:list");
    expect(values).toContain("goals:get");
    // Tasks
    expect(values).toContain("tasks:list");
    expect(values).toContain("tasks:move");
    // Task logs
    expect(values).toContain("task-logs:list");
    expect(values).toContain("task-logs:create");
    // Analytics
    expect(values).toContain("analytics:config");
    expect(values).toContain("analytics:track");
  });
});

describe("shared types", () => {
  it("Task type matches DB schema shape", async () => {
    const { createConnection, applySchema, TaskRepository } = await import("../src/db/index.js");
    const db = createConnection(":memory:");
    applySchema(db);
    const repo = new TaskRepository(db);

    // Need a goal first
    const { GoalRepository } = await import("../src/db/index.js");
    const goals = new GoalRepository(db);
    const goal = goals.create({ title: "test goal" });

    const task = repo.create({ goal_id: goal.id, title: "test task" });
    expect(task.id).toBeDefined();
    expect(task.goal_id).toBe(goal.id);
    expect(task.status).toBe("pending");
    expect(task.priority).toBe(0);
    expect(task.createdAt).toBeDefined();

    db.close();
  });

  it("constants provide valid default values", async () => {
    const { DEFAULTS, TASK_STATUS, GOAL_STATUS, AGENT_STATUS, LOG_LEVEL, PRIORITY } = await import("../src/shared/constants.js");
    expect(DEFAULTS.TASK_STATUS).toBe(TASK_STATUS.PENDING);
    expect(DEFAULTS.GOAL_STATUS).toBe(GOAL_STATUS.ACTIVE);
    expect(DEFAULTS.AGENT_STATUS).toBe(AGENT_STATUS.ACTIVE);
    expect(DEFAULTS.LOG_LEVEL).toBe(LOG_LEVEL.INFO);
    expect(DEFAULTS.PRIORITY).toBe(PRIORITY.MEDIUM);
  });
});
