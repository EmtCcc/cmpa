import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestConnection } from "../src/db/connection.js";
import { migrate, rollback, getMigrationStatus } from "../src/db/migrate.js";
import { AgentRepository } from "../src/db/repositories/agents.js";
import { GoalRepository } from "../src/db/repositories/goals.js";
import { TaskRepository } from "../src/db/repositories/tasks.js";
import { TaskLogRepository } from "../src/db/repositories/task-logs.js";

let db: Database.Database;
let agents: AgentRepository;
let goals: GoalRepository;
let tasks: TaskRepository;
let taskLogs: TaskLogRepository;

beforeEach(() => {
  db = createTestConnection();
  migrate(db);
  agents = new AgentRepository(db);
  goals = new GoalRepository(db);
  tasks = new TaskRepository(db);
  taskLogs = new TaskLogRepository(db);
});

afterEach(() => {
  db.close();
});

// ─── Agents ───

describe("AgentRepository", () => {
  it("creates and retrieves an agent", () => {
    const agent = agents.create({ name: "test-agent", role: "engineer" });
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe("test-agent");
    expect(agent.role).toBe("engineer");
    expect(agent.status).toBe("active");
    expect(agent.createdAt).toBeDefined();
    expect(agent.updatedAt).toBeDefined();

    const found = agents.getById(agent.id);
    expect(found).toEqual(agent);
  });

  it("lists agents", () => {
    agents.create({ name: "a1", role: "r1" });
    agents.create({ name: "a2", role: "r2" });
    const list = agents.list();
    expect(list.length).toBe(2);
  });

  it("updates an agent", () => {
    const agent = agents.create({ name: "orig", role: "r" });
    const updated = agents.update(agent.id, { name: "changed", status: "inactive" });
    expect(updated?.name).toBe("changed");
    expect(updated?.status).toBe("inactive");
    expect(updated?.role).toBe("r");
  });

  it("returns undefined for non-existent agent", () => {
    expect(agents.getById("nope")).toBeUndefined();
    expect(agents.update("nope", { name: "x" })).toBeUndefined();
  });

  it("deletes an agent", () => {
    const agent = agents.create({ name: "del", role: "r" });
    expect(agents.delete(agent.id)).toBe(true);
    expect(agents.getById(agent.id)).toBeUndefined();
  });

  it("returns false when deleting non-existent agent", () => {
    expect(agents.delete("nope")).toBe(false);
  });
});

// ─── Goals ───

describe("GoalRepository", () => {
  it("creates and retrieves a goal", () => {
    const goal = goals.create({ title: "Ship v1", description: "First release" });
    expect(goal.id).toBeDefined();
    expect(goal.title).toBe("Ship v1");
    expect(goal.description).toBe("First release");
    expect(goal.status).toBe("active");
    expect(goal.priority).toBe(0);

    const found = goals.getById(goal.id);
    expect(found).toEqual(goal);
  });

  it("lists goals ordered by priority", () => {
    goals.create({ title: "low", priority: 1 });
    goals.create({ title: "high", priority: 10 });
    const list = goals.list();
    expect(list[0].title).toBe("high");
    expect(list[1].title).toBe("low");
  });

  it("updates a goal", () => {
    const goal = goals.create({ title: "orig" });
    const updated = goals.update(goal.id, { title: "new", priority: 5 });
    expect(updated?.title).toBe("new");
    expect(updated?.priority).toBe(5);
  });

  it("deletes a goal", () => {
    const goal = goals.create({ title: "del" });
    expect(goals.delete(goal.id)).toBe(true);
    expect(goals.getById(goal.id)).toBeUndefined();
  });
});

// ─── Tasks ───

describe("TaskRepository", () => {
  let goalId: string;
  let agentId: string;

  beforeEach(() => {
    const goal = goals.create({ title: "g" });
    goalId = goal.id;
    const agent = agents.create({ name: "a", role: "r" });
    agentId = agent.id;
  });

  it("creates and retrieves a task", () => {
    const task = tasks.create({ goal_id: goalId, agent_id: agentId, title: "Do thing" });
    expect(task.id).toBeDefined();
    expect(task.goal_id).toBe(goalId);
    expect(task.agent_id).toBe(agentId);
    expect(task.title).toBe("Do thing");
    expect(task.status).toBe("pending");

    const found = tasks.getById(task.id);
    expect(found).toEqual(task);
  });

  it("creates task without agent", () => {
    const task = tasks.create({ goal_id: goalId, title: "Unassigned" });
    expect(task.agent_id).toBeNull();
  });

  it("lists tasks by goal", () => {
    tasks.create({ goal_id: goalId, title: "t1" });
    tasks.create({ goal_id: goalId, title: "t2" });
    const list = tasks.listByGoal(goalId);
    expect(list.length).toBe(2);
  });

  it("lists tasks by agent", () => {
    tasks.create({ goal_id: goalId, agent_id: agentId, title: "t1" });
    tasks.create({ goal_id: goalId, title: "t2" });
    const list = tasks.listByAgent(agentId);
    expect(list.length).toBe(1);
  });

  it("updates a task", () => {
    const task = tasks.create({ goal_id: goalId, title: "orig" });
    const updated = tasks.update(task.id, { title: "changed", status: "done" });
    expect(updated?.title).toBe("changed");
    expect(updated?.status).toBe("done");
  });

  it("nullifies agent_id on update", () => {
    const task = tasks.create({ goal_id: goalId, agent_id: agentId, title: "t" });
    const updated = tasks.update(task.id, { agent_id: null });
    expect(updated?.agent_id).toBeNull();
  });

  it("deletes a task", () => {
    const task = tasks.create({ goal_id: goalId, title: "del" });
    expect(tasks.delete(task.id)).toBe(true);
    expect(tasks.getById(task.id)).toBeUndefined();
  });
});

// ─── Task Logs ───

describe("TaskLogRepository", () => {
  let taskId: string;

  beforeEach(() => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    taskId = task.id;
  });

  it("creates and retrieves a task log", () => {
    const log = taskLogs.create({ task_id: taskId, message: "started", level: "info" });
    expect(log.id).toBeDefined();
    expect(log.task_id).toBe(taskId);
    expect(log.message).toBe("started");
    expect(log.level).toBe("info");
    expect(log.metadata).toBe("{}");

    const found = taskLogs.getById(log.id);
    expect(found).toEqual(log);
  });

  it("lists logs by task ordered by creation", () => {
    taskLogs.create({ task_id: taskId, message: "first" });
    taskLogs.create({ task_id: taskId, message: "second" });
    const list = taskLogs.listByTask(taskId);
    expect(list.length).toBe(2);
    expect(list[0].message).toBe("first");
    expect(list[1].message).toBe("second");
  });

  it("deletes a single log", () => {
    const log = taskLogs.create({ task_id: taskId, message: "del" });
    expect(taskLogs.delete(log.id)).toBe(true);
    expect(taskLogs.getById(log.id)).toBeUndefined();
  });

  it("deletes all logs for a task", () => {
    taskLogs.create({ task_id: taskId, message: "a" });
    taskLogs.create({ task_id: taskId, message: "b" });
    const count = taskLogs.deleteByTask(taskId);
    expect(count).toBe(2);
    expect(taskLogs.listByTask(taskId).length).toBe(0);
  });
});

// ─── Cascade deletes ───

describe("Cascade behavior", () => {
  it("deleting a goal cascades to tasks and task_logs", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    taskLogs.create({ task_id: task.id, message: "log" });

    goals.delete(goal.id);

    expect(tasks.getById(task.id)).toBeUndefined();
    expect(taskLogs.listByTask(task.id).length).toBe(0);
  });

  it("deleting a task cascades to task_logs", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    taskLogs.create({ task_id: task.id, message: "log" });

    tasks.delete(task.id);

    expect(taskLogs.listByTask(task.id).length).toBe(0);
  });

  it("deleting an agent sets task.agent_id to null", () => {
    const goal = goals.create({ title: "g" });
    const agent = agents.create({ name: "a", role: "r" });
    const task = tasks.create({ goal_id: goal.id, agent_id: agent.id, title: "t" });

    agents.delete(agent.id);

    const updated = tasks.getById(task.id);
    expect(updated?.agent_id).toBeNull();
  });
});

// ─── Migration system ───

describe("Migration system", () => {
  it("applies migrations and tracks status", () => {
    const status = getMigrationStatus(db);
    expect(status.length).toBeGreaterThan(0);
    expect(status[0].applied).toBe(true);
  });

  it("is idempotent — running migrate twice applies nothing new", () => {
    const applied = migrate(db);
    expect(applied.length).toBe(0);
  });

  it("rollback removes schema", () => {
    rollback(db, "001");

    // Tables should not exist after rollback
    expect(() => {
      db.prepare("SELECT * FROM agents").all();
    }).toThrow();
  });
});
