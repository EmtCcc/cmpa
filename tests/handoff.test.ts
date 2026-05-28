import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestConnection } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { AgentRepository } from "../src/db/repositories/agents.js";
import { GoalRepository } from "../src/db/repositories/goals.js";
import { TaskRepository } from "../src/db/repositories/tasks.js";
import { TaskLogRepository } from "../src/db/repositories/task-logs.js";
import { TaskHandoffRepository } from "../src/db/repositories/task-handoffs.js";

let db: Database.Database;
let agents: AgentRepository;
let goals: GoalRepository;
let tasks: TaskRepository;
let taskLogs: TaskLogRepository;
let handoffs: TaskHandoffRepository;

beforeEach(() => {
  db = createTestConnection();
  migrate(db);
  agents = new AgentRepository(db);
  goals = new GoalRepository(db);
  tasks = new TaskRepository(db);
  taskLogs = new TaskLogRepository(db);
  handoffs = new TaskHandoffRepository(db);
});

afterEach(() => {
  db.close();
});

// ─── Task Output ───

describe("Task output persistence", () => {
  it("creates task with output", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({
      goal_id: goal.id,
      title: "producer",
      output: '{"result": "hello"}',
    });
    expect(task.output).toBe('{"result": "hello"}');
  });

  it("creates task without output (default null)", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    expect(task.output).toBeNull();
  });

  it("sets output via setOutput", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    expect(task.output).toBeNull();

    const updated = tasks.setOutput(task.id, '{"data": 42}');
    expect(updated?.output).toBe('{"data": 42}');
  });

  it("updates output via update", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t", output: "old" });
    const updated = tasks.update(task.id, { output: "new" });
    expect(updated?.output).toBe("new");
  });
});

// ─── Task Dependencies ───

describe("Task dependencies", () => {
  it("creates task with depends_on", () => {
    const goal = goals.create({ title: "g" });
    const t1 = tasks.create({ goal_id: goal.id, title: "upstream" });
    const t2 = tasks.create({
      goal_id: goal.id,
      title: "downstream",
      depends_on: [t1.id],
    });
    expect(tasks.getDependsOn(t2.id)).toEqual([t1.id]);
  });

  it("creates task without depends_on (default empty)", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "t" });
    expect(tasks.getDependsOn(task.id)).toEqual([]);
  });

  it("sets depends_on via update", () => {
    const goal = goals.create({ title: "g" });
    const t1 = tasks.create({ goal_id: goal.id, title: "upstream" });
    const t2 = tasks.create({ goal_id: goal.id, title: "downstream" });

    const updated = tasks.update(t2.id, { depends_on: [t1.id] });
    expect(tasks.getDependsOn(updated!.id)).toEqual([t1.id]);
  });

  it("getDownstreamTasks returns tasks that depend on a given task", () => {
    const goal = goals.create({ title: "g" });
    const upstream = tasks.create({ goal_id: goal.id, title: "upstream" });
    const downstream1 = tasks.create({
      goal_id: goal.id,
      title: "down1",
      depends_on: [upstream.id],
    });
    const downstream2 = tasks.create({
      goal_id: goal.id,
      title: "down2",
      depends_on: [upstream.id],
    });
    const unrelated = tasks.create({ goal_id: goal.id, title: "other" });

    const downstream = tasks.getDownstreamTasks(upstream.id);
    expect(downstream.length).toBe(2);
    expect(downstream.map((t) => t.id).sort()).toEqual(
      [downstream1.id, downstream2.id].sort()
    );
  });

  it("getDownstreamTasks returns empty for task with no dependents", () => {
    const goal = goals.create({ title: "g" });
    const task = tasks.create({ goal_id: goal.id, title: "leaf" });
    expect(tasks.getDownstreamTasks(task.id)).toEqual([]);
  });

  it("supports multi-step pipeline A → B → C", () => {
    const goal = goals.create({ title: "g" });
    const a = tasks.create({ goal_id: goal.id, title: "A" });
    const b = tasks.create({ goal_id: goal.id, title: "B", depends_on: [a.id] });
    const c = tasks.create({ goal_id: goal.id, title: "C", depends_on: [b.id] });

    expect(tasks.getDependsOn(b.id)).toEqual([a.id]);
    expect(tasks.getDependsOn(c.id)).toEqual([b.id]);
    expect(tasks.getDownstreamTasks(a.id).map((t) => t.id)).toEqual([b.id]);
    expect(tasks.getDownstreamTasks(b.id).map((t) => t.id)).toEqual([c.id]);
    expect(tasks.getDownstreamTasks(c.id)).toEqual([]);
  });
});

// ─── TaskHandoff Repository ───

describe("TaskHandoffRepository", () => {
  let goalId: string;

  beforeEach(() => {
    const goal = goals.create({ title: "g" });
    goalId = goal.id;
  });

  it("creates a handoff", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });

    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
      output_snapshot: '{"key": "val"}',
    });

    expect(handoff.id).toBeDefined();
    expect(handoff.source_task_id).toBe(source.id);
    expect(handoff.target_task_id).toBe(target.id);
    expect(handoff.output_snapshot).toBe('{"key": "val"}');
    expect(handoff.status).toBe("pending");
    expect(handoff.error).toBeNull();
  });

  it("lists handoffs by source", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target1 = tasks.create({ goal_id: goalId, title: "t1" });
    const target2 = tasks.create({ goal_id: goalId, title: "t2" });

    handoffs.create({ source_task_id: source.id, target_task_id: target1.id });
    handoffs.create({ source_task_id: source.id, target_task_id: target2.id });

    const list = handoffs.listBySource(source.id);
    expect(list.length).toBe(2);
  });

  it("lists handoffs by target", () => {
    const source1 = tasks.create({ goal_id: goalId, title: "s1" });
    const source2 = tasks.create({ goal_id: goalId, title: "s2" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });

    handoffs.create({ source_task_id: source1.id, target_task_id: target.id });
    handoffs.create({ source_task_id: source2.id, target_task_id: target.id });

    const list = handoffs.listByTarget(target.id);
    expect(list.length).toBe(2);
  });

  it("completes a handoff", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });
    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
    });

    const completed = handoffs.complete(handoff.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).toBeTruthy();
  });

  it("fails a handoff with error", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });
    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
    });

    const failed = handoffs.fail(handoff.id, "upstream crashed");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("upstream crashed");
    expect(failed?.completedAt).toBeTruthy();
  });

  it("deletes a handoff", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });
    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
    });

    expect(handoffs.delete(handoff.id)).toBe(true);
    expect(handoffs.getById(handoff.id)).toBeUndefined();
  });

  it("cascade deletes when source task is deleted", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });
    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
    });

    tasks.delete(source.id);
    expect(handoffs.getById(handoff.id)).toBeUndefined();
  });

  it("cascade deletes when target task is deleted", () => {
    const source = tasks.create({ goal_id: goalId, title: "src" });
    const target = tasks.create({ goal_id: goalId, title: "tgt" });
    const handoff = handoffs.create({
      source_task_id: source.id,
      target_task_id: target.id,
    });

    tasks.delete(target.id);
    expect(handoffs.getById(handoff.id)).toBeUndefined();
  });
});

// ─── Pipeline A → B Integration ───

describe("Pipeline A → B integration", () => {
  it("full pipeline: create deps, set output, verify downstream", () => {
    const goal = goals.create({ title: "pipeline" });

    // Create A and B with B depending on A
    const taskA = tasks.create({ goal_id: goal.id, title: "Step A" });
    const taskB = tasks.create({
      goal_id: goal.id,
      title: "Step B",
      depends_on: [taskA.id],
    });

    // Simulate A completing with output
    tasks.setOutput(taskA.id, '{"analysis": "complete"}');
    tasks.update(taskA.id, { status: "done" });

    // Verify A's output is persisted
    const completedA = tasks.getById(taskA.id);
    expect(completedA?.output).toBe('{"analysis": "complete"}');
    expect(completedA?.status).toBe("done");

    // Verify B can read A's output
    const depIds = tasks.getDependsOn(taskB.id);
    expect(depIds).toEqual([taskA.id]);

    const upstreamTask = tasks.getById(depIds[0]);
    expect(upstreamTask?.output).toBe('{"analysis": "complete"}');

    // Create handoff record
    const handoff = handoffs.create({
      source_task_id: taskA.id,
      target_task_id: taskB.id,
      output_snapshot: upstreamTask!.output!,
    });

    expect(handoff.status).toBe("pending");
    expect(handoff.output_snapshot).toBe('{"analysis": "complete"}');

    // Complete the handoff
    handoffs.complete(handoff.id);
    const completedHandoff = handoffs.getById(handoff.id);
    expect(completedHandoff?.status).toBe("completed");
  });

  it("upstream failure blocks downstream handoff", () => {
    const goal = goals.create({ title: "pipeline" });

    const taskA = tasks.create({ goal_id: goal.id, title: "Step A" });
    const taskB = tasks.create({
      goal_id: goal.id,
      title: "Step B",
      depends_on: [taskA.id],
    });

    // Create pending handoff
    const handoff = handoffs.create({
      source_task_id: taskA.id,
      target_task_id: taskB.id,
    });

    // Simulate A failing — mark handoff as failed
    handoffs.fail(handoff.id, "Upstream task failed with exit code 1");

    const failedHandoff = handoffs.getById(handoff.id);
    expect(failedHandoff?.status).toBe("failed");
    expect(failedHandoff?.error).toContain("Upstream task failed");
  });

  it("multi-step pipeline with combined outputs", () => {
    const goal = goals.create({ title: "multi" });

    const a = tasks.create({ goal_id: goal.id, title: "A" });
    const b = tasks.create({ goal_id: goal.id, title: "B", depends_on: [a.id] });

    // A produces output
    tasks.setOutput(a.id, '{"step": "a_result"}');
    tasks.update(a.id, { status: "done" });

    // Handoff A → B
    const handoffAB = handoffs.create({
      source_task_id: a.id,
      target_task_id: b.id,
      output_snapshot: tasks.getById(a.id)!.output!,
    });

    // B runs, produces output
    tasks.setOutput(b.id, '{"step": "b_result", "input": "a_result"}');
    tasks.update(b.id, { status: "done" });
    handoffs.complete(handoffAB.id);

    // Verify full chain
    const finalB = tasks.getById(b.id);
    expect(finalB?.output).toContain("b_result");
    expect(finalB?.status).toBe("done");

    const completedHandoff = handoffs.getById(handoffAB.id);
    expect(completedHandoff?.status).toBe("completed");
  });
});
