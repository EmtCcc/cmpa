import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskQueue } from "../src/main/task-queue.js";
import { ORCHESTRATION_STATE } from "../src/shared/constants.js";
import type { OrchestrationStateChangeEvent } from "../src/shared/types.js";

// ── TaskQueue State Machine Tests ────────────────────────────────────

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe("enqueue", () => {
    it("creates a task in PENDING state", () => {
      const task = queue.enqueue("task-1");
      expect(task.state).toBe(ORCHESTRATION_STATE.PENDING);
      expect(task.taskId).toBe("task-1");
      expect(task.agentId).toBeNull();
      expect(task.error).toBeNull();
      expect(task.retryCount).toBe(0);
    });

    it("assigns priority", () => {
      const task = queue.enqueue("task-1", 5);
      expect(task.priority).toBe(5);
    });

    it("defaults priority to 0", () => {
      const task = queue.enqueue("task-1");
      expect(task.priority).toBe(0);
    });
  });

  describe("transition", () => {
    it("pending → assigned", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.ASSIGNED);
      expect(updated.agentId).toBe("agent-1");
    });

    it("assigned → running", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.RUNNING);
      expect(updated.startedAt).toBeTruthy();
    });

    it("running → completed", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      queue.transition(task.id, ORCHESTRATION_STATE.COMPLETED);
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.COMPLETED);
      expect(updated.completedAt).toBeTruthy();
    });

    it("running → failed", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      queue.transition(task.id, ORCHESTRATION_STATE.FAILED, { error: "crash" });
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.FAILED);
      expect(updated.error).toBe("crash");
      expect(updated.completedAt).toBeTruthy();
    });

    it("failed → pending (retry)", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      queue.transition(task.id, ORCHESTRATION_STATE.FAILED, { error: "crash" });
      queue.transition(task.id, ORCHESTRATION_STATE.PENDING);
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.PENDING);
      expect(updated.retryCount).toBe(1);
      expect(updated.error).toBeNull();
      expect(updated.agentId).toBeNull();
    });

    it("pending → failed (cancel from pending)", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.FAILED, { error: "cancelled" });
      const updated = queue.get(task.id)!;
      expect(updated.state).toBe(ORCHESTRATION_STATE.FAILED);
    });

    it("rejects invalid transitions", () => {
      const task = queue.enqueue("task-1");
      expect(() => {
        queue.transition(task.id, ORCHESTRATION_STATE.COMPLETED);
      }).toThrow("Invalid transition: pending → completed");
    });

    it("rejects transition from completed", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      queue.transition(task.id, ORCHESTRATION_STATE.COMPLETED);
      expect(() => {
        queue.transition(task.id, ORCHESTRATION_STATE.FAILED);
      }).toThrow("Invalid transition: completed → failed");
    });

    it("throws for nonexistent task", () => {
      expect(() => {
        queue.transition("nonexistent", ORCHESTRATION_STATE.ASSIGNED);
      }).toThrow("Task nonexistent not found");
    });
  });

  describe("stateChange event", () => {
    it("emits on every transition", () => {
      const events: OrchestrationStateChangeEvent[] = [];
      queue.on("stateChange", (e) => events.push(e));

      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "agent-1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        taskId: task.id,
        oldState: ORCHESTRATION_STATE.PENDING,
        newState: ORCHESTRATION_STATE.ASSIGNED,
        agentId: "agent-1",
      });
      expect(events[1]).toMatchObject({
        taskId: task.id,
        oldState: ORCHESTRATION_STATE.ASSIGNED,
        newState: ORCHESTRATION_STATE.RUNNING,
      });
    });
  });

  describe("getByState", () => {
    it("returns tasks sorted by priority descending then createdAt", () => {
      const t1 = queue.enqueue("task-1", 1);
      const t2 = queue.enqueue("task-2", 3);
      const t3 = queue.enqueue("task-3", 1);

      const pending = queue.getByState(ORCHESTRATION_STATE.PENDING);
      expect(pending.map((t) => t.id)).toEqual([t2.id, t1.id, t3.id]);
    });

    it("returns empty for state with no tasks", () => {
      queue.enqueue("task-1");
      expect(queue.getByState(ORCHESTRATION_STATE.RUNNING)).toEqual([]);
    });
  });

  describe("countByState", () => {
    it("counts tasks per state", () => {
      queue.enqueue("task-1");
      queue.enqueue("task-2");
      expect(queue.countByState(ORCHESTRATION_STATE.PENDING)).toBe(2);
      expect(queue.countByState(ORCHESTRATION_STATE.RUNNING)).toBe(0);
    });
  });

  describe("cancel", () => {
    it("cancels a pending task", () => {
      const task = queue.enqueue("task-1");
      expect(queue.cancel(task.id)).toBe(true);
      expect(queue.get(task.id)!.state).toBe(ORCHESTRATION_STATE.FAILED);
    });

    it("cancels an assigned task", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
      expect(queue.cancel(task.id)).toBe(true);
      expect(queue.get(task.id)!.state).toBe(ORCHESTRATION_STATE.FAILED);
    });

    it("cannot cancel a running task", () => {
      const task = queue.enqueue("task-1");
      queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
      queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      expect(queue.cancel(task.id)).toBe(false);
      expect(queue.get(task.id)!.state).toBe(ORCHESTRATION_STATE.RUNNING);
    });

    it("returns false for nonexistent task", () => {
      expect(queue.cancel("nonexistent")).toBe(false);
    });
  });

  describe("remove", () => {
    it("removes a task", () => {
      const task = queue.enqueue("task-1");
      expect(queue.remove(task.id)).toBe(true);
      expect(queue.get(task.id)).toBeUndefined();
    });

    it("returns false for nonexistent task", () => {
      expect(queue.remove("nonexistent")).toBe(false);
    });
  });
});

// ── ProcessPool Tests ────────────────────────────────────────────────

// We test ProcessPool logic without actually spawning processes.
// The pool's acquire() calls spawn(), so we mock child_process for unit tests.

describe("ProcessPool", () => {
  // ProcessPool tests require mocking child_process.spawn.
  // We test the capacity logic and slot management here.

  it("hasCapacity reflects maxParallel limit", async () => {
    const { ProcessPool } = await import("../src/main/process-pool.js");
    const pool = new ProcessPool(2);
    expect(pool.hasCapacity).toBe(true);
    expect(pool.activeCount).toBe(0);
    pool.releaseAll();
  });

  it("maxParallel setter clamps to at least 1", async () => {
    const { ProcessPool } = await import("../src/main/process-pool.js");
    const pool = new ProcessPool(4);
    pool.maxParallel = 0;
    expect(pool.maxParallel).toBe(1);
    pool.maxParallel = -5;
    expect(pool.maxParallel).toBe(1);
    pool.releaseAll();
  });
});

// ── Full State Machine Coverage ──────────────────────────────────────

describe("Orchestration state machine coverage", () => {
  it("covers all valid transitions", () => {
    const queue = new TaskQueue();

    // pending → assigned → running → completed
    const t1 = queue.enqueue("t1");
    queue.transition(t1.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
    queue.transition(t1.id, ORCHESTRATION_STATE.RUNNING);
    queue.transition(t1.id, ORCHESTRATION_STATE.COMPLETED);
    expect(queue.get(t1.id)!.state).toBe(ORCHESTRATION_STATE.COMPLETED);

    // pending → assigned → running → failed → pending (retry) → assigned → running → completed
    const t2 = queue.enqueue("t2");
    queue.transition(t2.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
    queue.transition(t2.id, ORCHESTRATION_STATE.RUNNING);
    queue.transition(t2.id, ORCHESTRATION_STATE.FAILED, { error: "boom" });
    expect(queue.get(t2.id)!.retryCount).toBe(0);
    queue.transition(t2.id, ORCHESTRATION_STATE.PENDING);
    expect(queue.get(t2.id)!.retryCount).toBe(1);
    queue.transition(t2.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a2" });
    queue.transition(t2.id, ORCHESTRATION_STATE.RUNNING);
    queue.transition(t2.id, ORCHESTRATION_STATE.COMPLETED);
    expect(queue.get(t2.id)!.state).toBe(ORCHESTRATION_STATE.COMPLETED);
    expect(queue.get(t2.id)!.retryCount).toBe(1);

    // pending → failed (direct cancel)
    const t3 = queue.enqueue("t3");
    queue.transition(t3.id, ORCHESTRATION_STATE.FAILED, { error: "cancelled" });
    expect(queue.get(t3.id)!.state).toBe(ORCHESTRATION_STATE.FAILED);

    // assigned → failed (cancel after assign)
    const t4 = queue.enqueue("t4");
    queue.transition(t4.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
    queue.transition(t4.id, ORCHESTRATION_STATE.FAILED, { error: "cancelled" });
    expect(queue.get(t4.id)!.state).toBe(ORCHESTRATION_STATE.FAILED);

    // assigned → pending (unassign)
    const t5 = queue.enqueue("t5");
    queue.transition(t5.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
    queue.transition(t5.id, ORCHESTRATION_STATE.PENDING);
    expect(queue.get(t5.id)!.state).toBe(ORCHESTRATION_STATE.PENDING);
  });

  it("rejects all invalid transitions", () => {
    const queue = new TaskQueue();
    const invalidTransitions = [
      // completed is terminal
      [ORCHESTRATION_STATE.COMPLETED, ORCHESTRATION_STATE.PENDING],
      [ORCHESTRATION_STATE.COMPLETED, ORCHESTRATION_STATE.ASSIGNED],
      [ORCHESTRATION_STATE.COMPLETED, ORCHESTRATION_STATE.RUNNING],
      [ORCHESTRATION_STATE.COMPLETED, ORCHESTRATION_STATE.FAILED],
      // pending can't go to running or completed directly
      [ORCHESTRATION_STATE.PENDING, ORCHESTRATION_STATE.RUNNING],
      [ORCHESTRATION_STATE.PENDING, ORCHESTRATION_STATE.COMPLETED],
      // assigned can't go to completed directly
      [ORCHESTRATION_STATE.ASSIGNED, ORCHESTRATION_STATE.COMPLETED],
      // running can't go back to assigned or pending
      [ORCHESTRATION_STATE.RUNNING, ORCHESTRATION_STATE.ASSIGNED],
      [ORCHESTRATION_STATE.RUNNING, ORCHESTRATION_STATE.PENDING],
    ];

    for (const [from, to] of invalidTransitions) {
      const task = queue.enqueue(`test-${from}-${to}`);
      // Move to the 'from' state
      if (from === ORCHESTRATION_STATE.ASSIGNED) {
        queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
      } else if (from === ORCHESTRATION_STATE.RUNNING) {
        queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
        queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
      } else if (from === ORCHESTRATION_STATE.COMPLETED) {
        queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: "a1" });
        queue.transition(task.id, ORCHESTRATION_STATE.RUNNING);
        queue.transition(task.id, ORCHESTRATION_STATE.COMPLETED);
      }

      expect(() => {
        queue.transition(task.id, to as any);
      }).toThrow(/Invalid transition/);
    }
  });
});
