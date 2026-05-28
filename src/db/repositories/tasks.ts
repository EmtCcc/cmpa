import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Task {
  id: string;
  goal_id: string;
  agent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  sub_state: string | null;
  started_at: string | null;
  priority: number;
  output: string | null;
  depends_on: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  goal_id: string;
  agent_id?: string;
  title: string;
  description?: string;
  status?: string;
  sub_state?: string;
  priority?: number;
  output?: string;
  depends_on?: string[];
}

export interface UpdateTaskInput {
  goal_id?: string;
  agent_id?: string | null;
  title?: string;
  description?: string;
  status?: string;
  sub_state?: string;
  priority?: number;
  output?: string;
  depends_on?: string[];
}

export class TaskRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskInput): Task {
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = input.status ?? "pending";
    const startedAt = status === "in_progress" ? now : null;
    const dependsOn = input.depends_on ? JSON.stringify(input.depends_on) : "[]";
    this.db
      .prepare(
        `INSERT INTO tasks (id, goal_id, agent_id, title, description, status, sub_state, started_at, priority, output, depends_on, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.goal_id,
        input.agent_id ?? null,
        input.title,
        input.description ?? null,
        status,
        input.sub_state ?? null,
        startedAt,
        input.priority ?? 0,
        input.output ?? null,
        dependsOn,
        now,
        now
      );
    return this.getById(id)!;
  }

  getById(id: string): Task | undefined {
    return this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as Task | undefined;
  }

  list(): Task[] {
    return this.db
      .prepare("SELECT * FROM tasks ORDER BY priority DESC, createdAt DESC")
      .all() as Task[];
  }

  listByGoal(goalId: string): Task[] {
    return this.db
      .prepare(
        "SELECT * FROM tasks WHERE goal_id = ? ORDER BY priority DESC, createdAt DESC"
      )
      .all(goalId) as Task[];
  }

  listByAgent(agentId: string): Task[] {
    return this.db
      .prepare(
        "SELECT * FROM tasks WHERE agent_id = ? ORDER BY priority DESC, createdAt DESC"
      )
      .all(agentId) as Task[];
  }

  update(id: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.goal_id !== undefined) {
      fields.push("goal_id = ?");
      values.push(input.goal_id);
    }
    if (input.agent_id !== undefined) {
      fields.push("agent_id = ?");
      values.push(input.agent_id);
    }
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
      // Auto-set started_at when moving to in_progress, clear sub_state on exit
      if (input.status === "in_progress" && existing.status !== "in_progress") {
        fields.push("started_at = ?");
        values.push(now);
      } else if (input.status !== "in_progress" && existing.status === "in_progress") {
        fields.push("sub_state = NULL");
        fields.push("started_at = NULL");
      }
    }
    if (input.sub_state !== undefined) {
      fields.push("sub_state = ?");
      values.push(input.sub_state);
    }
    if (input.priority !== undefined) {
      fields.push("priority = ?");
      values.push(input.priority);
    }
    if (input.output !== undefined) {
      fields.push("output = ?");
      values.push(input.output);
    }
    if (input.depends_on !== undefined) {
      fields.push("depends_on = ?");
      values.push(JSON.stringify(input.depends_on));
    }
    fields.push("updatedAt = ?");
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
    return this.getById(id);
  }

  /** Set the output of a task (used by orchestrator on completion). */
  setOutput(id: string, output: string): Task | undefined {
    return this.update(id, { output });
  }

  /** Get task IDs that this task depends on. */
  getDependsOn(id: string): string[] {
    const task = this.getById(id);
    if (!task) return [];
    try {
      return JSON.parse(task.depends_on) as string[];
    } catch {
      return [];
    }
  }

  /** Get tasks that depend on the given task (downstream tasks). */
  getDownstreamTasks(taskId: string): Task[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks WHERE depends_on LIKE ? ORDER BY priority DESC, createdAt DESC`
      )
      .all(`%${taskId}%`) as Task[];
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM tasks WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }
}
