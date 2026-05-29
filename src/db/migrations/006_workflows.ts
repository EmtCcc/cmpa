import type { Migration } from "../migrate.js";

export const migration: Migration = {
  id: "006",
  description: "Create workflows table for visual workflow builder definitions",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        definition TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
        is_template INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);
    `);
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS workflows;
    `);
  },
};
