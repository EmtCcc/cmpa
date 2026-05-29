import type Database from "better-sqlite3";
import { createConnection } from "./connection.js";
import { migrations } from "./migrations/index.js";

export interface Migration {
  id: string;
  description: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

function ensureMigrationTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getAppliedIds(db: Database.Database): Set<string> {
  const rows = db
    .prepare("SELECT id FROM _migrations ORDER BY id")
    .all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

export function migrate(db: Database.Database): string[] {
  ensureMigrationTable(db);
  const applied = getAppliedIds(db);
  const appliedThisRun: string[] = [];

  const sorted = [...migrations].sort((a, b) => a.id.localeCompare(b.id));

  for (const migration of sorted) {
    if (applied.has(migration.id)) continue;

    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO _migrations (id, description) VALUES (?, ?)").run(
        migration.id,
        migration.description
      );
    });
    tx();
    appliedThisRun.push(migration.id);
  }

  return appliedThisRun;
}

export function rollback(db: Database.Database, targetId?: string): string[] {
  ensureMigrationTable(db);
  const applied = getAppliedIds(db);
  const rolledBack: string[] = [];

  const sorted = [...migrations].sort((a, b) => b.id.localeCompare(a.id));

  for (const migration of sorted) {
    if (!applied.has(migration.id)) continue;
    if (targetId && migration.id < targetId) break;

    const tx = db.transaction(() => {
      migration.down(db);
      db.prepare("DELETE FROM _migrations WHERE id = ?").run(migration.id);
    });
    tx();
    rolledBack.push(migration.id);

    if (targetId && migration.id === targetId) break;
  }

  return rolledBack;
}

export function getMigrationStatus(
  db: Database.Database
): { id: string; description: string; applied: boolean; appliedAt?: string }[] {
  ensureMigrationTable(db);
  const appliedRows = db
    .prepare("SELECT id, applied_at FROM _migrations")
    .all() as { id: string; applied_at: string }[];
  const appliedMap = new Map(appliedRows.map((r) => [r.id, r.applied_at]));

  return migrations
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({
      id: m.id,
      description: m.description,
      applied: appliedMap.has(m.id),
      appliedAt: appliedMap.get(m.id),
    }));
}

// CLI entry point
if (process.argv[1]?.endsWith("migrate.ts")) {
  const db = createConnection();
  const applied = migrate(db);
  if (applied.length === 0) {
    console.log("All migrations already applied.");
  } else {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  }
  db.close();
}
