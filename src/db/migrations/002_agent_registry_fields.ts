import type { Migration } from "../migrate.js";

export const migration: Migration = {
  id: "002",
  description: "Add agent registry fields: executable_path, working_directory, agent_type, config_json",
  up: (db) => {
    db.exec(`
      ALTER TABLE agents ADD COLUMN executable_path TEXT;
      ALTER TABLE agents ADD COLUMN working_directory TEXT;
      ALTER TABLE agents ADD COLUMN agent_type TEXT NOT NULL DEFAULT 'custom';
      ALTER TABLE agents ADD COLUMN config_json TEXT DEFAULT '{}';
    `);
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN in older versions, so recreate table
    db.exec(`
      CREATE TABLE agents_backup (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        config TEXT DEFAULT '{}',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO agents_backup SELECT id, name, role, status, config, createdAt, updatedAt FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_backup RENAME TO agents;
    `);
  },
};
