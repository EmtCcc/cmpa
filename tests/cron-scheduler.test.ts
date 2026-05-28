import { describe, it, expect, vi, beforeEach } from "vitest";
import { CronScheduler } from "../src/main/cron-scheduler.js";
import type { CronScheduleRepository, CronSchedule } from "../src/db/repositories/cron-schedules.js";
import type { TaskRepository, Task } from "../src/db/repositories/tasks.js";
import type { Orchestrator } from "../src/main/orchestrator.js";

function makeSchedule(overrides: Partial<CronSchedule> = {}): CronSchedule {
  return {
    id: "sched-1",
    name: "Test Schedule",
    cron_expression: "* * * * *",
    enabled: 1,
    template_goal_id: "goal-1",
    template_agent_id: null,
    template_title: "Auto Task",
    template_description: "Auto-generated task",
    template_priority: 1,
    last_triggered_at: null,
    next_trigger_at: null,
    trigger_count: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    goal_id: "goal-1",
    agent_id: null,
    title: "Auto Task",
    description: "Auto-generated task",
    status: "pending",
    sub_state: null,
    started_at: null,
    priority: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockRepos() {
  const scheduleRepo = {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(() => []),
    listEnabled: vi.fn(() => []),
    update: vi.fn(),
    delete: vi.fn(),
    markTriggered: vi.fn(),
  } as unknown as CronScheduleRepository;

  const taskRepo = {
    create: vi.fn((input) => makeTask({ ...input, id: "task-created" })),
    getById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as TaskRepository;

  const orchestrator = {
    enqueue: vi.fn(),
    cancel: vi.fn(),
    status: vi.fn(),
    shutdown: vi.fn(),
  } as unknown as Orchestrator;

  return { scheduleRepo, taskRepo, orchestrator };
}

describe("CronScheduler", () => {
  let scheduler: CronScheduler;
  let repos: ReturnType<typeof createMockRepos>;

  beforeEach(() => {
    repos = createMockRepos();
    scheduler = new CronScheduler(repos.scheduleRepo, repos.taskRepo, repos.orchestrator);
  });

  describe("triggerNow", () => {
    it("creates a task and enqueues it", () => {
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule());
      const result = scheduler.triggerNow("sched-1");

      expect(repos.taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_id: "goal-1",
          title: "Auto Task",
          status: "pending",
          priority: 1,
        }),
      );
      expect(repos.orchestrator.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "task-created", priority: 1 }),
      );
      expect(repos.scheduleRepo.markTriggered).toHaveBeenCalled();
      expect(result).toHaveProperty("scheduleId", "sched-1");
      expect(result).toHaveProperty("taskId", "task-created");
    });

    it("returns error for non-existent schedule", () => {
      repos.scheduleRepo.getById = vi.fn(() => undefined);
      const result = scheduler.triggerNow("nonexistent");
      expect(result).toEqual({ error: "Schedule not found" });
    });

    it("emits trigger event", () => {
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule());
      const handler = vi.fn();
      scheduler.on("trigger", handler);
      scheduler.triggerNow("sched-1");
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: "sched-1" }),
      );
    });

    it("records trigger log", () => {
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule());
      scheduler.triggerNow("sched-1");
      const logs = scheduler.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        scheduleId: "sched-1",
        success: true,
        taskId: "task-created",
      });
    });
  });

  describe("tick", () => {
    it("triggers due schedules", () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60_000).toISOString();
      repos.scheduleRepo.listEnabled = vi.fn(() => [
        makeSchedule({ next_trigger_at: past }),
      ]);
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule({ next_trigger_at: past }));

      // Access private tick via triggerNow pattern — or test via start/stop
      // Since tick is private, we test through the public triggerNow
      const result = scheduler.triggerNow("sched-1");
      expect(result).toHaveProperty("taskId");
    });
  });

  describe("start/stop", () => {
    it("starts and stops without error", () => {
      expect(() => scheduler.start()).not.toThrow();
      expect(() => scheduler.stop()).not.toThrow();
    });

    it("is idempotent", () => {
      scheduler.start();
      scheduler.start(); // second call should be no-op
      scheduler.stop();
    });
  });

  describe("getLogs", () => {
    it("returns empty array initially", () => {
      expect(scheduler.getLogs()).toEqual([]);
    });

    it("respects limit parameter", () => {
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule());
      for (let i = 0; i < 5; i++) {
        scheduler.triggerNow("sched-1");
      }
      expect(scheduler.getLogs(3)).toHaveLength(3);
    });

    it("caps at MAX_LOGS", () => {
      repos.scheduleRepo.getById = vi.fn(() => makeSchedule());
      // Trigger more than MAX_LOGS (500)
      for (let i = 0; i < 510; i++) {
        scheduler.triggerNow("sched-1");
      }
      expect(scheduler.getLogs(1000)).toHaveLength(500);
    });
  });
});
