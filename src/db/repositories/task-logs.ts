import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface TaskLog {
  id: string;
  task_id: string;
  level: string;
  message: string;
  metadata: string;
  createdAt: string;
}

export interface CreateTaskLogInput {
  task_id: string;
  level?: string;
  message: string;
  metadata?: string;
}

export class TaskLogRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskLogInput): TaskLog {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO task_logs (id, task_id, level, message, metadata, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.task_id,
        input.level ?? "info",
        input.message,
        input.metadata ?? "{}",
        now
      );
    return this.getById(id)!;
  }

  getById(id: string): TaskLog | undefined {
    return this.db
      .prepare("SELECT * FROM task_logs WHERE id = ?")
      .get(id) as TaskLog | undefined;
  }

  listByTask(taskId: string): TaskLog[] {
    return this.db
      .prepare(
        "SELECT * FROM task_logs WHERE task_id = ? ORDER BY createdAt ASC"
      )
      .all(taskId) as TaskLog[];
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM task_logs WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  deleteByTask(taskId: string): number {
    const result = this.db
      .prepare("DELETE FROM task_logs WHERE task_id = ?")
      .run(taskId);
    return result.changes;
  }
}
