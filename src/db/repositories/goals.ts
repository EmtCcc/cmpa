import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  status?: string;
  priority?: number;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
}

export class GoalRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateGoalInput): Goal {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO goals (id, title, description, status, priority, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.title,
        input.description ?? null,
        input.status ?? "active",
        input.priority ?? 0,
        now,
        now
      );
    return this.getById(id)!;
  }

  getById(id: string): Goal | undefined {
    return this.db
      .prepare("SELECT * FROM goals WHERE id = ?")
      .get(id) as Goal | undefined;
  }

  list(): Goal[] {
    return this.db
      .prepare("SELECT * FROM goals ORDER BY priority DESC, createdAt DESC")
      .all() as Goal[];
  }

  update(id: string, input: UpdateGoalInput): Goal | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      fields.push("title = ?");
      values.push(input.title);
    }
    if (input.description !== undefined) {
      fields.push("description = ?");
      values.push(input.description);
    }
    if (input.status !== undefined) {
      fields.push("status = ?");
      values.push(input.status);
    }
    if (input.priority !== undefined) {
      fields.push("priority = ?");
      values.push(input.priority);
    }
    fields.push("updatedAt = ?");
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE goals SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM goals WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }
}
