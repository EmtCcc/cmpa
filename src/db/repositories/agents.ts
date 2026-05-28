import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  config: string;
  executable_path: string | null;
  working_directory: string | null;
  agent_type: string;
  config_json: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  role: string;
  status?: string;
  config?: string;
  executable_path?: string;
  working_directory?: string;
  agent_type?: string;
  config_json?: string;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  status?: string;
  config?: string;
  executable_path?: string | null;
  working_directory?: string | null;
  agent_type?: string;
  config_json?: string;
}

export class AgentRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateAgentInput): Agent {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO agents (id, name, role, status, config, executable_path, working_directory, agent_type, config_json, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.role,
        input.status ?? "active",
        input.config ?? "{}",
        input.executable_path ?? null,
        input.working_directory ?? null,
        input.agent_type ?? "custom",
        input.config_json ?? "{}",
        now,
        now
      );
    return this.getById(id)!;
  }

  getById(id: string): Agent | undefined {
    return this.db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .get(id) as Agent | undefined;
  }

  list(): Agent[] {
    return this.db
      .prepare("SELECT * FROM agents ORDER BY createdAt DESC")
      .all() as Agent[];
  }

  update(id: string, input: UpdateAgentInput): Agent | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      fields.push("name = ?");
      values.push(input.name);
    }
    if (input.role !== undefined) {
      fields.push("role = ?");
      values.push(input.role);
    }
    if (input.status !== undefined) {
      fields.push("status = ?");
      values.push(input.status);
    }
    if (input.config !== undefined) {
      fields.push("config = ?");
      values.push(input.config);
    }
    if (input.executable_path !== undefined) {
      fields.push("executable_path = ?");
      values.push(input.executable_path);
    }
    if (input.working_directory !== undefined) {
      fields.push("working_directory = ?");
      values.push(input.working_directory);
    }
    if (input.agent_type !== undefined) {
      fields.push("agent_type = ?");
      values.push(input.agent_type);
    }
    if (input.config_json !== undefined) {
      fields.push("config_json = ?");
      values.push(input.config_json);
    }
    fields.push("updatedAt = ?");
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE agents SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
    return this.getById(id);
  }

  updateStatus(id: string, status: string): Agent | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE agents SET status = ?, updatedAt = ? WHERE id = ?")
      .run(status, now, id);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM agents WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }
}
