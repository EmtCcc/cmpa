import { EventEmitter } from "node:events";
import { basename, delimiter } from "node:path";
import { accessSync, constants } from "node:fs";
import type { BrowserWindow } from "electron";
import { TaskQueue } from "./task-queue.js";
import { ProcessPool, type SlotExitEvent, type SlotErrorEvent } from "./process-pool.js";
import type { AgentRepository, TaskRepository, TaskHandoffRepository } from "../db/index.js";
import type {
  EnqueueTaskInput,
  OrchestrationTask,
  OrchestratorStatus,
  OrchestrationStateChangeEvent,
} from "../shared/types.js";
import { ORCHESTRATION_STATE, IPC_CHANNELS } from "../shared/constants.js";
import { ALLOWED_EXECUTABLES } from "./agent-runtime.js";

/**
 * Orchestrator — ties TaskQueue + ProcessPool together.
 *
 * Lifecycle:
 * 1. enqueue(taskId) → task enters PENDING
 * 2. _drain() picks highest-priority PENDING tasks, assigns agents, moves to ASSIGNED
 * 3. Acquires a pool slot, spawns the process, moves to RUNNING
 * 4. On process exit: moves to COMPLETED or FAILED
 * 5. On crash: independent of other agents — only the crashed slot is affected
 *
 * Agent selection: round-robin among available agents with executable_path set.
 * Concurrency: maxParallel limits how many processes run simultaneously.
 */
export class Orchestrator extends EventEmitter {
  readonly queue: TaskQueue;
  readonly pool: ProcessPool;

  private agentRepo: AgentRepository;
  private taskRepo: TaskRepository;
  private handoffRepo: TaskHandoffRepository;
  private getMainWindow: () => BrowserWindow | null;
  private agentIndex = 0; // round-robin cursor
  private slotToOrchTaskId = new Map<string, string>(); // slotId → orchestrationTaskId

  constructor(
    agentRepo: AgentRepository,
    taskRepo: TaskRepository,
    handoffRepo: TaskHandoffRepository,
    getMainWindow: () => BrowserWindow | null,
    maxParallel: number = 4,
  ) {
    super();
    this.agentRepo = agentRepo;
    this.taskRepo = taskRepo;
    this.handoffRepo = handoffRepo;
    this.getMainWindow = getMainWindow;
    this.queue = new TaskQueue();
    this.pool = new ProcessPool(maxParallel);

    // Re-drain when a slot becomes available
    this.pool.on("available", () => this._drain());

    // Handle process exits — update orchestration task state
    this.pool.on("exit", (event: SlotExitEvent) => {
      this.handleSlotExit(event);
    });

    // Handle process errors — mark task as failed
    this.pool.on("error", (event: SlotErrorEvent) => {
      this.handleSlotError(event);
    });

    // Forward queue state changes as IPC push events
    this.queue.on("stateChange", (event: OrchestrationStateChangeEvent) => {
      this.emit("stateChange", event);
      const win = this.getMainWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.ORCHESTRATION_STATE_CHANGED, event);
      }
    });
  }

  get maxParallel(): number {
    return this.pool.maxParallel;
  }

  set maxParallel(value: number) {
    this.pool.maxParallel = value;
    // Re-drain in case we increased capacity
    this._drain();
  }

  /**
   * Enqueue a task for orchestration.
   * The task enters PENDING and will be picked up by _drain() when a slot is available.
   */
  enqueue(input: EnqueueTaskInput): OrchestrationTask {
    const task = this.queue.enqueue(input.taskId, input.priority ?? 0);
    // Try to assign immediately
    this._drain();
    return task;
  }

  /**
   * Cancel an orchestration task.
   * If the task is RUNNING, kills the associated process.
   */
  cancel(orchestrationTaskId: string): boolean {
    const task = this.queue.get(orchestrationTaskId);
    if (!task) return false;

    if (task.state === ORCHESTRATION_STATE.RUNNING) {
      // Find and kill the slot
      for (const [slotId, orchTaskId] of this.slotToOrchTaskId) {
        if (orchTaskId === orchestrationTaskId) {
          this.pool.release(slotId);
          this.slotToOrchTaskId.delete(slotId);
          break;
        }
      }
    }

    return this.queue.cancel(orchestrationTaskId);
  }

  /** Get current orchestrator status. */
  status(): OrchestratorStatus {
    return {
      queueDepth: this.queue.countByState(ORCHESTRATION_STATE.PENDING),
      runningCount: this.pool.activeCount,
      maxParallel: this.pool.maxParallel,
      tasks: this.queue.all(),
    };
  }

  /** Shutdown — kill all running processes. */
  shutdown(): void {
    this.pool.releaseAll();
    this.slotToOrchTaskId.clear();
  }

  /**
   * Drain the queue: pick up PENDING tasks and assign them to available agents.
   * Called automatically after enqueue, slot availability, and state transitions.
   */
  private _drain(): void {
    while (this.pool.hasCapacity) {
      const pending = this.queue.getByState(ORCHESTRATION_STATE.PENDING);
      if (pending.length === 0) break;

      const task = pending[0]; // highest priority
      const agent = this.selectAgent();
      if (!agent) break; // no available agents

      // Move to ASSIGNED
      this.queue.transition(task.id, ORCHESTRATION_STATE.ASSIGNED, { agentId: agent.id });

      // Resolve executable
      const executable = agent.executable_path;
      if (!executable) {
        this.queue.transition(task.id, ORCHESTRATION_STATE.FAILED, {
          agentId: agent.id,
          error: "Agent has no executable path",
        });
        continue;
      }

      // Acquire pool slot and spawn
      // If there's pending handoff context, inject it as TASK_INPUT env var
      const handoffContext = this.pendingHandouts.get(task.taskId);
      const env = handoffContext ? { TASK_INPUT: handoffContext } : undefined;
      this.pendingHandouts.delete(task.taskId);

      const slotId = this.pool.acquire(
        task.id,
        agent.id,
        executable,
        [], // agents run with no extra args — they read their task from DB
        agent.working_directory ?? undefined,
        env,
      );

      if (!slotId) {
        // Pool full (shouldn't happen due to hasCapacity check, but safety)
        this.queue.transition(task.id, ORCHESTRATION_STATE.PENDING);
        break;
      }

      this.slotToOrchTaskId.set(slotId, task.id);

      // Move to RUNNING
      this.queue.transition(task.id, ORCHESTRATION_STATE.RUNNING, { agentId: agent.id });
    }
  }

  /**
   * Select an available agent using round-robin.
   * Skips agents without executable_path.
   */
  private selectAgent(): { id: string; executable_path: string; working_directory: string | null } | null {
    const agents = this.agentRepo.list().filter((a) => a.executable_path);
    if (agents.length === 0) return null;

    // Check which agents are already running in the pool
    const busyAgentIds = new Set<string>();
    for (const slot of this.pool.list()) {
      busyAgentIds.add(slot.agentId);
    }

    // Find next available agent (round-robin, skip busy)
    for (let i = 0; i < agents.length; i++) {
      const idx = (this.agentIndex + i) % agents.length;
      const agent = agents[idx];
      if (!busyAgentIds.has(agent.id)) {
        this.agentIndex = (idx + 1) % agents.length;
        return {
          id: agent.id,
          executable_path: agent.executable_path!,
          working_directory: agent.working_directory,
        };
      }
    }

    return null; // all agents busy
  }

  private handleSlotExit(event: SlotExitEvent): void {
    const orchTaskId = this.slotToOrchTaskId.get(event.slotId);
    this.slotToOrchTaskId.delete(event.slotId);
    if (!orchTaskId) return;

    const orchTask = this.queue.get(orchTaskId);
    if (!orchTask) return;

    if (event.exitCode === 0) {
      this.queue.transition(orchTaskId, ORCHESTRATION_STATE.COMPLETED, {
        agentId: event.agentId,
      });

      // Persist output to DB task
      if (event.stdout) {
        this.taskRepo.setOutput(orchTask.taskId, event.stdout);
      }

      // Trigger downstream handoffs
      this._triggerDownstreamHandoffs(orchTask.taskId, event.stdout);
    } else {
      this.queue.transition(orchTaskId, ORCHESTRATION_STATE.FAILED, {
        agentId: event.agentId,
        error: `Process exited with code ${event.exitCode}${event.signal ? ` (signal: ${event.signal})` : ""}`,
      });

      // Mark downstream handoffs as failed (upstream failure blocks downstream)
      this._failDownstreamHandoffs(orchTask.taskId, `Upstream task failed with exit code ${event.exitCode}`);
    }
  }

  private handleSlotError(event: SlotErrorEvent): void {
    const orchTaskId = this.slotToOrchTaskId.get(event.slotId);
    this.slotToOrchTaskId.delete(event.slotId);
    if (!orchTaskId) return;

    const orchTask = this.queue.get(orchTaskId);
    this.queue.transition(orchTaskId, ORCHESTRATION_STATE.FAILED, {
      agentId: event.agentId,
      error: event.error,
    });

    if (orchTask) {
      this._failDownstreamHandoffs(orchTask.taskId, `Upstream task errored: ${event.error}`);
    }
  }

  /**
   * After a task completes, check for downstream tasks that depend on it.
   * If all dependencies of a downstream task are satisfied, enqueue it.
   */
  private _triggerDownstreamHandoffs(completedTaskId: string, output: string): void {
    const downstreamTasks = this.taskRepo.getDownstreamTasks(completedTaskId);

    for (const downstream of downstreamTasks) {
      const dependsOn = this.taskRepo.getDependsOn(downstream.id);

      // Check if all dependencies have completed with output
      const allDepsSatisfied = dependsOn.every((depId) => {
        if (depId === completedTaskId) return true;
        const depTask = this.taskRepo.getById(depId);
        return depTask && depTask.status === "done" && depTask.output !== null;
      });

      if (!allDepsSatisfied) continue;

      // Create handoff record
      this.handoffRepo.create({
        source_task_id: completedTaskId,
        target_task_id: downstream.id,
        output_snapshot: output,
      });

      // Collect all upstream outputs for the downstream task
      const upstreamOutputs: Record<string, string> = {};
      for (const depId of dependsOn) {
        const depTask = this.taskRepo.getById(depId);
        if (depTask?.output) {
          upstreamOutputs[depId] = depTask.output;
        }
      }

      // Store the combined upstream context in the downstream task's output field temporarily
      // The agent will read it from TASK_INPUT env var
      const handoffContext = JSON.stringify({
        upstream_outputs: upstreamOutputs,
        source_task_id: completedTaskId,
      });

      // Enqueue the downstream task for orchestration
      this.enqueue({ taskId: downstream.id });

      // Store handoff context so _drain can inject it
      this.pendingHandouts.set(downstream.id, handoffContext);
    }
  }

  // Map of taskId → handoff context (upstream outputs) to inject when spawning
  private pendingHandouts = new Map<string, string>();

  /**
   * When upstream fails, mark all downstream handoffs as failed.
   * Downstream tasks that depend on the failed task should not execute.
   */
  private _failDownstreamHandoffs(failedTaskId: string, error: string): void {
    const downstreamTasks = this.taskRepo.getDownstreamTasks(failedTaskId);
    for (const downstream of downstreamTasks) {
      const handoffs = this.handoffRepo.listByTarget(downstream.id);
      for (const handoff of handoffs) {
        if (handoff.source_task_id === failedTaskId && handoff.status === "pending") {
          this.handoffRepo.fail(handoff.id, error);
        }
      }
    }
  }
}
