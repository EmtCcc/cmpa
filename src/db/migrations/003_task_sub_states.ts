import type { Migration } from "../migrate.js";

export const migration: Migration = {
  id: "003",
  description: "Add sub_state and started_at columns to tasks for granular progress tracking",
  up: (db) => {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN sub_state TEXT;
      ALTER TABLE tasks ADD COLUMN started_at TEXT;
    `);
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN before 3.35.0; recreate table instead.
    db.exec(`
      CREATE TABLE tasks_backup (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        agent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
      );
      INSERT INTO tasks_backup SELECT id, goal_id, agent_id, title, description, status, priority, createdAt, updatedAt FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_backup RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
    `);
  },
};
