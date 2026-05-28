/**
 * HTTP API routes for /api/settings
 * Input validation + RBAC permission checks applied.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { extractUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody, validateString } from "../validation.js";
import { parseBody, sendJson, sendError } from "../route-utils.js";

const PATH = "/api/settings";

interface SettingsRow {
  key: string;
  value: string;
}

export function createSettingsRoutes(db: Database.Database) {
  // Ensure settings table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const getAllStmt = db.prepare("SELECT key, value FROM settings");
  const getStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  const upsertStmt = db.prepare(`
    INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `);
  const deleteStmt = db.prepare("DELETE FROM settings WHERE key = ?");

  return async function handleSettings(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!req.url?.startsWith(PATH)) return false;

    try {
      const user = extractUser(req);
      const method = req.method ?? "GET";

      // GET /api/settings
      if (method === "GET" && req.url === PATH) {
        requirePermission(user, "settings:read");
        const rows = getAllStmt.all() as SettingsRow[];
        const settings: Record<string, string> = {};
        for (const row of rows) {
          settings[row.key] = row.value;
        }
        sendJson(res, 200, { settings });
        return true;
      }

      // GET /api/settings/:key
      if (method === "GET") {
        requirePermission(user, "settings:read");
        const key = req.url.slice(PATH.length + 1);
        if (!key) return false;
        const row = getStmt.get(key) as SettingsRow | undefined;
        if (!row) {
          sendJson(res, 404, { error: "Setting not found" });
          return true;
        }
        sendJson(res, 200, { key, value: row.value });
        return true;
      }

      // PUT /api/settings/:key
      if (method === "PUT") {
        requirePermission(user, "settings:update");
        const key = req.url.slice(PATH.length + 1);
        if (!key) return false;
        const body = validateBody(await parseBody(req));
        const value = validateString(body.value, "value", { maxLength: 10000 });

        upsertStmt.run(key, value);
        sendJson(res, 200, { key, value });
        return true;
      }

      // DELETE /api/settings/:key
      if (method === "DELETE") {
        requirePermission(user, "settings:update");
        const key = req.url.slice(PATH.length + 1);
        if (!key) return false;
        const result = deleteStmt.run(key);
        if (result.changes === 0) {
          sendJson(res, 404, { error: "Setting not found" });
          return true;
        }
        sendJson(res, 204, null);
        return true;
      }

      return false;
    } catch (error) {
      sendError(res, error);
      return true;
    }
  };
}
