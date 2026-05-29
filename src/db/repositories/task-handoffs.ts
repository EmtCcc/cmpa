import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface TaskHandoff {
  id: string;
  source_task_id: string;
  target_task_id: string;
  output_snapshot: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateHandoffInput {
  source_task_id: string;
  target_task_id: string;
  output_snapshot?: string;
}

export class TaskHandoffRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateHandoffInput): TaskHandoff {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO task_handoffs (id, source_task_id, target_task_id, output_snapshot, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.source_task_id,
        input.target_task_id,
        input.output_snapshot ?? null,
        "pending",
        now
      );
    return this.getById(id)!;
  }

  getById(id: string): TaskHandoff | undefined {
    return this.db
      .prepare("SELECT * FROM task_handoffs WHERE id = ?")
      .get(id) as TaskHandoff | undefined;
  }

  listBySource(sourceTaskId: string): TaskHandoff[] {
    return this.db
      .prepare(
        "SELECT * FROM task_handoffs WHERE source_task_id = ? ORDER BY createdAt ASC"
      )
      .all(sourceTaskId) as TaskHandoff[];
  }

  listByTarget(targetTaskId: string): TaskHandoff[] {
    return this.db
      .prepare(
        "SELECT * FROM task_handoffs WHERE target_task_id = ? ORDER BY createdAt ASC"
      )
      .all(targetTaskId) as TaskHandoff[];
  }

  /** Mark a handoff as completed. */
  complete(id: string): TaskHandoff | undefined {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE task_handoffs SET status = 'completed', completedAt = ? WHERE id = ?")
      .run(now, id);
    return this.getById(id);
  }

  /** Mark a handoff as failed. */
  fail(id: string, error: string): TaskHandoff | undefined {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE task_handoffs SET status = 'failed', error = ?, completedAt = ? WHERE id = ?")
      .run(error, now, id);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM task_handoffs WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  deleteBySource(sourceTaskId: string): number {
    const result = this.db
      .prepare("DELETE FROM task_handoffs WHERE source_task_id = ?")
      .run(sourceTaskId);
    return result.changes;
  }
}
