import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  definition: string; // JSON-serialized WorkflowDefinition
  is_template: number; // 0 or 1
  built_in: number; // 0 or 1
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition?: string; // JSON string
  is_template?: boolean;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  definition?: string; // JSON string
  is_template?: boolean;
}

export class WorkflowRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateWorkflowInput): WorkflowRow {
    const id = randomUUID();
    const now = new Date().toISOString();
    const def = input.definition ?? '{"nodes":[],"edges":[]}';
    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, definition, is_template, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description ?? null,
        def,
        input.is_template ? 1 : 0,
        now,
        now,
      );
    return this.getById(id)!;
  }

  getById(id: string): WorkflowRow | undefined {
    return this.db
      .prepare("SELECT * FROM workflows WHERE id = ?")
      .get(id) as WorkflowRow | undefined;
  }

  list(): WorkflowRow[] {
    return this.db
      .prepare("SELECT * FROM workflows ORDER BY createdAt DESC")
      .all() as WorkflowRow[];
  }

  listTemplates(): WorkflowRow[] {
    return this.db
      .prepare("SELECT * FROM workflows WHERE is_template = 1 ORDER BY name ASC")
      .all() as WorkflowRow[];
  }

  update(id: string, input: UpdateWorkflowInput): WorkflowRow | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.definition !== undefined) { fields.push("definition = ?"); values.push(input.definition); }
    if (input.is_template !== undefined) { fields.push("is_template = ?"); values.push(input.is_template ? 1 : 0); }

    fields.push("updatedAt = ?");
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE workflows SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM workflows WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  /** List only built-in templates (seeded by migrations, not user-created). */
  listBuiltIn(): WorkflowRow[] {
    return this.db
      .prepare("SELECT * FROM workflows WHERE is_template = 1 AND built_in = 1 ORDER BY name ASC")
      .all() as WorkflowRow[];
  }

  /** List user-saved templates only. */
  listUserTemplates(): WorkflowRow[] {
    return this.db
      .prepare("SELECT * FROM workflows WHERE is_template = 1 AND (built_in = 0 OR built_in IS NULL) ORDER BY updatedAt DESC")
      .all() as WorkflowRow[];
  }

  /**
   * Instantiate a template into a new workflow.
   * Clones the template's definition and creates a new non-template workflow.
   * Optional overrides: name, description, definition patches.
   */
  instantiate(
    templateId: string,
    overrides?: { name?: string; description?: string; definitionPatch?: string },
  ): WorkflowRow | undefined {
    const template = this.getById(templateId);
    if (!template) return undefined;

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = overrides?.name ?? `${template.name} — Copy`;
    const description = overrides?.description ?? template.description;
    const definition = overrides?.definitionPatch ?? template.definition;

    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, definition, is_template, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(id, name, description, definition, now, now);
    return this.getById(id);
  }

  /**
   * Save an existing workflow as a new template (clone with is_template=1).
   */
  saveAsTemplate(
    workflowId: string,
    overrides?: { name?: string; description?: string },
  ): WorkflowRow | undefined {
    const source = this.getById(workflowId);
    if (!source) return undefined;

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = overrides?.name ?? `${source.name} (Template)`;
    const description = overrides?.description ?? source.description;

    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, definition, is_template, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(id, name, description, source.definition, now, now);
    return this.getById(id);
  }
}
