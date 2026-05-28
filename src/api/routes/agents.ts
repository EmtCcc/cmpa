/**
 * HTTP API routes for /api/agents
 * Input validation + RBAC permission checks applied.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentRepository } from "../../db/repositories/agents.js";
import { extractUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody, validateString, validateOptionalString, validateUUID } from "../validation.js";
import { parseBody, sendJson, sendError, getPathParam } from "../route-utils.js";

const PATH = "/api/agents";

export function createAgentRoutes(repo: AgentRepository) {
  return async function handleAgents(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!req.url?.startsWith(PATH)) return false;

    try {
      const user = extractUser(req);
      const method = req.method ?? "GET";

      // GET /api/agents
      if (method === "GET" && req.url === PATH) {
        requirePermission(user, "agents:read");
        sendJson(res, 200, { agents: repo.list() });
        return true;
      }

      // GET /api/agents/:id
      if (method === "GET") {
        requirePermission(user, "agents:read");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const agent = repo.getById(validateUUID(id, "id"));
        if (!agent) {
          sendJson(res, 404, { error: "Agent not found" });
          return true;
        }
        sendJson(res, 200, { agent });
        return true;
      }

      // POST /api/agents
      if (method === "POST" && req.url === PATH) {
        requirePermission(user, "agents:create");
        const body = validateBody(await parseBody(req));
        const name = validateString(body.name, "name", { minLength: 1, maxLength: 255 });
        const role = validateString(body.role, "role", { minLength: 1, maxLength: 100 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["active", "inactive", "error"] as const,
        });
        const config = validateOptionalString(body.config, "config", { maxLength: 10000 });

        const agent = repo.create({ name, role, status, config });
        sendJson(res, 201, { agent });
        return true;
      }

      // PATCH /api/agents/:id
      if (method === "PATCH") {
        requirePermission(user, "agents:update");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const validId = validateUUID(id, "id");
        const body = validateBody(await parseBody(req));
        const name = validateOptionalString(body.name, "name", { minLength: 1, maxLength: 255 });
        const role = validateOptionalString(body.role, "role", { minLength: 1, maxLength: 100 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["active", "inactive", "error"] as const,
        });
        const config = validateOptionalString(body.config, "config", { maxLength: 10000 });

        const agent = repo.update(validId, { name, role, status, config });
        if (!agent) {
          sendJson(res, 404, { error: "Agent not found" });
          return true;
        }
        sendJson(res, 200, { agent });
        return true;
      }

      // DELETE /api/agents/:id
      if (method === "DELETE") {
        requirePermission(user, "agents:delete");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const deleted = repo.delete(validateUUID(id, "id"));
        if (!deleted) {
          sendJson(res, 404, { error: "Agent not found" });
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
