import type { Migration } from "../migrate.js";

export const migration: Migration = {
  id: "005",
  description: "Add output, depends_on to tasks; create task_handoffs table for agent result relay",
  up: (db) => {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN output TEXT;
      ALTER TABLE tasks ADD COLUMN depends_on TEXT DEFAULT '[]';

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

      CREATE INDEX IF NOT EXISTS idx_task_handoffs_source ON task_handoffs(source_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_handoffs_target ON task_handoffs(target_task_id);
    `);
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS task_handoffs;

      CREATE TABLE tasks_backup (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        agent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sub_state TEXT,
        started_at TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
      );
      INSERT INTO tasks_backup SELECT id, goal_id, agent_id, title, description, status, sub_state, started_at, priority, createdAt, updatedAt FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_backup RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
    `);
  },
};
