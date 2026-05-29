/**
 * HTTP API server entry point.
 * Creates an HTTP server with all API routes, validation, and RBAC.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { AgentRepository } from "../db/repositories/agents.js";
import { GoalRepository } from "../db/repositories/goals.js";
import { TaskRepository } from "../db/repositories/tasks.js";
import { createAgentRoutes } from "./routes/agents.js";
import { createGoalRoutes } from "./routes/goals.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { createSettingsRoutes } from "./routes/settings.js";
import { sendJson } from "./route-utils.js";

export function createApiServer(db: Database.Database, port = 3000) {
  const agentRoutes = createAgentRoutes(new AgentRepository(db));
  const goalRoutes = createGoalRoutes(new GoalRepository(db));
  const taskRoutes = createTaskRoutes(new TaskRepository(db));
  const settingsRoutes = createSettingsRoutes(db);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Id, X-User-Role");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route to handlers
    if (await agentRoutes(req, res)) return;
    if (await goalRoutes(req, res)) return;
    if (await taskRoutes(req, res)) return;
    if (await settingsRoutes(req, res)) return;

    // Health check
    if (req.url === "/api/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });

  return {
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(port, () => {
          console.log(`API server listening on http://localhost:${port}`);
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
