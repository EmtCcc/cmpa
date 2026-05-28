import type { Migration } from "../migrate.js";

export const migration: Migration = {
  id: "004",
  description: "Add cron_schedules table for automated task scheduling",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cron_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        template_goal_id TEXT,
        template_agent_id TEXT,
        template_title TEXT NOT NULL,
        template_description TEXT,
        template_priority INTEGER NOT NULL DEFAULT 0,
        last_triggered_at TEXT,
        next_trigger_at TEXT,
        trigger_count INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cron_schedules_enabled ON cron_schedules(enabled);
    `);
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS cron_schedules;
    `);
  },
};
