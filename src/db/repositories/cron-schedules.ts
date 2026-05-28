import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface CronSchedule {
  id: string;
  name: string;
  cron_expression: string;
  enabled: number; // 0 or 1 (SQLite boolean)
  template_goal_id: string | null;
  template_agent_id: string | null;
  template_title: string;
  template_description: string | null;
  template_priority: number;
  last_triggered_at: string | null;
  next_trigger_at: string | null;
  trigger_count: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCronScheduleInput {
  name: string;
  cron_expression: string;
  enabled?: boolean;
  template_goal_id?: string;
  template_agent_id?: string;
  template_title: string;
  template_description?: string;
  template_priority?: number;
  next_trigger_at?: string;
}

export interface UpdateCronScheduleInput {
  name?: string;
  cron_expression?: string;
  enabled?: boolean;
  template_goal_id?: string | null;
  template_agent_id?: string | null;
  template_title?: string;
  template_description?: string | null;
  template_priority?: number;
  last_triggered_at?: string;
  next_trigger_at?: string | null;
  trigger_count?: number;
}

export class CronScheduleRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateCronScheduleInput): CronSchedule {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO cron_schedules (id, name, cron_expression, enabled, template_goal_id, template_agent_id, template_title, template_description, template_priority, next_trigger_at, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.cron_expression,
        input.enabled !== false ? 1 : 0,
        input.template_goal_id ?? null,
        input.template_agent_id ?? null,
        input.template_title,
        input.template_description ?? null,
        input.template_priority ?? 0,
        input.next_trigger_at ?? null,
        now,
        now,
      );
    return this.getById(id)!;
  }

  getById(id: string): CronSchedule | undefined {
    return this.db
      .prepare("SELECT * FROM cron_schedules WHERE id = ?")
      .get(id) as CronSchedule | undefined;
  }

  list(): CronSchedule[] {
    return this.db
      .prepare("SELECT * FROM cron_schedules ORDER BY createdAt DESC")
      .all() as CronSchedule[];
  }

  listEnabled(): CronSchedule[] {
    return this.db
      .prepare("SELECT * FROM cron_schedules WHERE enabled = 1 ORDER BY next_trigger_at ASC")
      .all() as CronSchedule[];
  }

  update(id: string, input: UpdateCronScheduleInput): CronSchedule | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.cron_expression !== undefined) { fields.push("cron_expression = ?"); values.push(input.cron_expression); }
    if (input.enabled !== undefined) { fields.push("enabled = ?"); values.push(input.enabled ? 1 : 0); }
    if (input.template_goal_id !== undefined) { fields.push("template_goal_id = ?"); values.push(input.template_goal_id); }
    if (input.template_agent_id !== undefined) { fields.push("template_agent_id = ?"); values.push(input.template_agent_id); }
    if (input.template_title !== undefined) { fields.push("template_title = ?"); values.push(input.template_title); }
    if (input.template_description !== undefined) { fields.push("template_description = ?"); values.push(input.template_description); }
    if (input.template_priority !== undefined) { fields.push("template_priority = ?"); values.push(input.template_priority); }
    if (input.last_triggered_at !== undefined) { fields.push("last_triggered_at = ?"); values.push(input.last_triggered_at); }
    if (input.next_trigger_at !== undefined) { fields.push("next_trigger_at = ?"); values.push(input.next_trigger_at); }
    if (input.trigger_count !== undefined) { fields.push("trigger_count = ?"); values.push(input.trigger_count); }

    fields.push("updatedAt = ?");
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE cron_schedules SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM cron_schedules WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /** Mark a schedule as triggered: update last_triggered_at, next_trigger_at, and increment count. */
  markTriggered(id: string, nextTriggerAt: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE cron_schedules SET last_triggered_at = ?, next_trigger_at = ?, trigger_count = trigger_count + 1, updatedAt = ? WHERE id = ?`
      )
      .run(now, nextTriggerAt, now, id);
  }
}
