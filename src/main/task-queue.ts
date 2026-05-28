import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { OrchestrationTask, OrchestrationStateChangeEvent } from "../shared/types.js";
import { ORCHESTRATION_STATE, type OrchestrationState } from "../shared/constants.js";

/**
 * Valid state transitions for the orchestration task state machine.
 *
 *   pending → assigned → running → completed
 *                             ↘ failed → (retry) → pending
 *           → failed (if cancelled from pending/assigned)
 */
const VALID_TRANSITIONS: Record<OrchestrationState, Set<OrchestrationState>> = {
  [ORCHESTRATION_STATE.PENDING]: new Set([ORCHESTRATION_STATE.ASSIGNED, ORCHESTRATION_STATE.FAILED]),
  [ORCHESTRATION_STATE.ASSIGNED]: new Set([ORCHESTRATION_STATE.RUNNING, ORCHESTRATION_STATE.FAILED, ORCHESTRATION_STATE.PENDING]),
  [ORCHESTRATION_STATE.RUNNING]: new Set([ORCHESTRATION_STATE.COMPLETED, ORCHESTRATION_STATE.FAILED]),
  [ORCHESTRATION_STATE.COMPLETED]: new Set(),
  [ORCHESTRATION_STATE.FAILED]: new Set([ORCHESTRATION_STATE.PENDING]), // retry
};

/**
 * TaskQueue — in-memory state machine for orchestration tasks.
 *
 * Manages the lifecycle: pending → assigned → running → completed/failed.
 * Emits 'stateChange' events on every transition.
 */
export class TaskQueue extends EventEmitter {
  private tasks = new Map<string, OrchestrationTask>();

  enqueue(taskId: string, priority: number = 0): OrchestrationTask {
    const id = randomUUID();
    const now = new Date().toISOString();
    const task: OrchestrationTask = {
      id,
      taskId,
      agentId: null,
      state: ORCHESTRATION_STATE.PENDING,
      priority,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      output: null,
    };
    this.tasks.set(id, task);
    return task;
  }

  get(id: string): OrchestrationTask | undefined {
    return this.tasks.get(id);
  }

  /** Get all tasks in a given state, sorted by priority (descending) then createdAt. */
  getByState(state: OrchestrationState): OrchestrationTask[] {
    const result: OrchestrationTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.state === state) result.push(task);
    }
    result.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
    return result;
  }

  /** Return count of tasks in a given state. */
  countByState(state: OrchestrationState): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.state === state) count++;
    }
    return count;
  }

  /** Snapshot of all tasks. */
  all(): OrchestrationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Transition a task to a new state.
   * Throws on invalid transitions.
   */
  transition(id: string, newState: OrchestrationState, meta?: { agentId?: string; error?: string }): OrchestrationTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const allowed = VALID_TRANSITIONS[task.state];
    if (!allowed.has(newState)) {
      throw new Error(`Invalid transition: ${task.state} → ${newState} for task ${id}`);
    }

    const oldState = task.state;
    const now = new Date().toISOString();

    task.state = newState;
    if (meta?.agentId !== undefined) task.agentId = meta.agentId;
    if (meta?.error !== undefined) task.error = meta.error;

    if (newState === ORCHESTRATION_STATE.RUNNING) {
      task.startedAt = now;
    } else if (newState === ORCHESTRATION_STATE.COMPLETED || newState === ORCHESTRATION_STATE.FAILED) {
      task.completedAt = now;
    } else if (newState === ORCHESTRATION_STATE.PENDING && oldState === ORCHESTRATION_STATE.FAILED) {
      // Retry: clear error, bump retryCount
      task.error = null;
      task.agentId = null;
      task.startedAt = null;
      task.completedAt = null;
      task.retryCount++;
    } else if (newState === ORCHESTRATION_STATE.ASSIGNED) {
      // Agent assigned but not yet running
      task.startedAt = null;
    }

    this.emit("stateChange", {
      taskId: id,
      oldState,
      newState,
      agentId: task.agentId,
      error: meta?.error,
    } satisfies OrchestrationStateChangeEvent);

    return task;
  }

  /** Cancel a task — moves it to failed from pending or assigned. */
  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.state !== ORCHESTRATION_STATE.PENDING && task.state !== ORCHESTRATION_STATE.ASSIGNED) {
      return false;
    }
    this.transition(id, ORCHESTRATION_STATE.FAILED, { error: "cancelled" });
    return true;
  }

  /** Remove a task from the queue entirely (e.g., after completion cleanup). */
  remove(id: string): boolean {
    return this.tasks.delete(id);
  }
}
