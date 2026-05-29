import type Database from "better-sqlite3";

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      config TEXT DEFAULT '{}',
      executable_path TEXT,
      working_directory TEXT,
      agent_type TEXT NOT NULL DEFAULT 'custom',
      config_json TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      priority INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      agent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sub_state TEXT,
      started_at TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      output TEXT,
      depends_on TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_handoffs (
      id TEXT PRIMARY KEY,
      source_task_id TEXT NOT NULL,
      target_task_id TEXT NOT NULL,
      output_snapshot TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      completedAt TEXT,
      FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_handoffs_source ON task_handoffs(source_task_id);
    CREATE INDEX IF NOT EXISTS idx_task_handoffs_target ON task_handoffs(target_task_id);
  `);
}
