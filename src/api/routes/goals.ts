/**
 * HTTP API routes for /api/goals
 * Input validation + RBAC permission checks applied.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { GoalRepository } from "../../db/repositories/goals.js";
import { extractUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody, validateString, validateOptionalString, validateOptionalNumber, validateUUID } from "../validation.js";
import { parseBody, sendJson, sendError, getPathParam } from "../route-utils.js";

const PATH = "/api/goals";

export function createGoalRoutes(repo: GoalRepository) {
  return async function handleGoals(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!req.url?.startsWith(PATH)) return false;

    try {
      const user = extractUser(req);
      const method = req.method ?? "GET";

      // GET /api/goals
      if (method === "GET" && req.url === PATH) {
        requirePermission(user, "goals:read");
        sendJson(res, 200, { goals: repo.list() });
        return true;
      }

      // GET /api/goals/:id
      if (method === "GET") {
        requirePermission(user, "goals:read");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const goal = repo.getById(validateUUID(id, "id"));
        if (!goal) {
          sendJson(res, 404, { error: "Goal not found" });
          return true;
        }
        sendJson(res, 200, { goal });
        return true;
      }

      // POST /api/goals
      if (method === "POST" && req.url === PATH) {
        requirePermission(user, "goals:create");
        const body = validateBody(await parseBody(req));
        const title = validateString(body.title, "title", { minLength: 1, maxLength: 500 });
        const description = validateOptionalString(body.description, "description", { maxLength: 5000 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["active", "completed", "archived"] as const,
        });
        const priority = validateOptionalNumber(body.priority, "priority", { min: 0, max: 100, integer: true });

        const goal = repo.create({ title, description, status, priority });
        sendJson(res, 201, { goal });
        return true;
      }

      // PATCH /api/goals/:id
      if (method === "PATCH") {
        requirePermission(user, "goals:update");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const validId = validateUUID(id, "id");
        const body = validateBody(await parseBody(req));
        const title = validateOptionalString(body.title, "title", { minLength: 1, maxLength: 500 });
        const description = validateOptionalString(body.description, "description", { maxLength: 5000 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["active", "completed", "archived"] as const,
        });
        const priority = validateOptionalNumber(body.priority, "priority", { min: 0, max: 100, integer: true });

        const goal = repo.update(validId, { title, description, status, priority });
        if (!goal) {
          sendJson(res, 404, { error: "Goal not found" });
          return true;
        }
        sendJson(res, 200, { goal });
        return true;
      }

      // DELETE /api/goals/:id
      if (method === "DELETE") {
        requirePermission(user, "goals:delete");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const deleted = repo.delete(validateUUID(id, "id"));
        if (!deleted) {
          sendJson(res, 404, { error: "Goal not found" });
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
