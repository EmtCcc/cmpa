import { EventEmitter } from "node:events";
import type { CronScheduleRepository, CronSchedule } from "../db/repositories/cron-schedules.js";
import type { TaskRepository } from "../db/repositories/tasks.js";
import type { Orchestrator } from "./orchestrator.js";
import { parseCron, matchesCron, nextTriggerTimes, CronParseError } from "./cron-parser.js";

export interface CronTriggerEvent {
  scheduleId: string;
  scheduleName: string;
  taskId: string;
  triggeredAt: string;
  cronExpression: string;
}

export interface CronLogEntry {
  scheduleId: string;
  scheduleName: string;
  cronExpression: string;
  triggeredAt: string;
  taskId: string | null;
  success: boolean;
  error?: string;
}

/**
 * CronScheduler — checks cron schedules on a timer and auto-creates + enqueues tasks.
 *
 * Lifecycle:
 * 1. Starts a 30-second interval tick
 * 2. On each tick, loads all enabled schedules whose next_trigger_at <= now
 * 3. For each due schedule: creates a DB task, enqueues it in the orchestrator
 * 4. Updates the schedule's next_trigger_at for the next occurrence
 * 5. Emits trigger events for logging/UI
 */
export class CronScheduler extends EventEmitter {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_MS = 30_000; // check every 30 seconds
  private logs: CronLogEntry[] = [];
  private readonly MAX_LOGS = 500;

  constructor(
    private scheduleRepo: CronScheduleRepository,
    private taskRepo: TaskRepository,
    private orchestrator: Orchestrator,
  ) {
    super();
  }

  /** Start the scheduler tick loop. */
  start(): void {
    if (this.tickInterval) return;
    // Run first tick immediately, then on interval
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), this.TICK_MS);
  }

  /** Stop the scheduler tick loop. */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /** Get recent trigger logs. */
  getLogs(limit: number = 50): CronLogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Manually trigger a schedule now (regardless of cron timing).
   * Useful for testing or ad-hoc runs.
   */
  triggerNow(scheduleId: string): CronTriggerEvent | { error: string } {
    const schedule = this.scheduleRepo.getById(scheduleId);
    if (!schedule) return { error: "Schedule not found" };
    return this.executeSchedule(schedule);
  }

  /**
   * One tick: find all due schedules, execute them, update next_trigger_at.
   */
  private tick(): void {
    const now = new Date();
    const enabled = this.scheduleRepo.listEnabled();

    for (const schedule of enabled) {
      if (this.isDue(schedule, now)) {
        this.executeSchedule(schedule, now);
      }
    }
  }

  /**
   * Check if a schedule is due for triggering.
   * Uses next_trigger_at if available, otherwise parses cron and checks current time.
   */
  private isDue(schedule: CronSchedule, now: Date): boolean {
    // If we have a next_trigger_at, check against it
    if (schedule.next_trigger_at) {
      const next = new Date(schedule.next_trigger_at);
      return now >= next;
    }

    // Fallback: parse cron and check if current minute matches
    try {
      const cron = parseCron(schedule.cron_expression);
      return matchesCron(cron, now);
    } catch {
      return false; // invalid cron, skip
    }
  }

  /**
   * Execute a schedule: create a task, enqueue it, compute next trigger time.
   */
  private executeSchedule(schedule: CronSchedule, now?: Date): CronTriggerEvent | { error: string } {
    const triggeredAt = (now ?? new Date()).toISOString();

    try {
      // Create a DB task from the template
      const task = this.taskRepo.create({
        goal_id: schedule.template_goal_id ?? "00000000-0000-0000-0000-000000000000", // fallback goal
        agent_id: schedule.template_agent_id ?? undefined,
        title: schedule.template_title,
        description: schedule.template_description ?? `[Auto-scheduled] ${schedule.name}`,
        status: "pending",
        priority: schedule.template_priority,
      });

      // Enqueue in orchestrator
      this.orchestrator.enqueue({ taskId: task.id, priority: schedule.template_priority });

      // Compute next trigger time
      const nextTrigger = this.computeNextTrigger(schedule.cron_expression, now ?? new Date());

      // Update schedule
      this.scheduleRepo.markTriggered(schedule.id, nextTrigger.toISOString());

      const event: CronTriggerEvent = {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        taskId: task.id,
        triggeredAt,
        cronExpression: schedule.cron_expression,
      };

      this.addLog({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        cronExpression: schedule.cron_expression,
        triggeredAt,
        taskId: task.id,
        success: true,
      });

      this.emit("trigger", event);
      return event;
    } catch (err) {
      const error = (err as Error).message;
      this.addLog({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        cronExpression: schedule.cron_expression,
        triggeredAt,
        taskId: null,
        success: false,
        error,
      });
      this.emit("error", { scheduleId: schedule.id, error });
      return { error };
    }
  }

  /**
   * Compute the next trigger time after a given date.
   */
  private computeNextTrigger(expression: string, after: Date): Date {
    try {
      const cron = parseCron(expression);
      const nexts = nextTriggerTimes(cron, after, 1);
      if (nexts.length > 0) return nexts[0];
    } catch {
      // If parse fails, fallback to 1 hour from now
    }
    return new Date(after.getTime() + 3600_000);
  }

  private addLog(entry: CronLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }
}
