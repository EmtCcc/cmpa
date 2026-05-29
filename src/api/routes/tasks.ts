/**
 * HTTP API routes for /api/tasks
 * Input validation + RBAC permission checks applied.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { TaskRepository } from "../../db/repositories/tasks.js";
import { extractUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody, validateString, validateOptionalString, validateOptionalNumber, validateUUID } from "../validation.js";
import { parseBody, sendJson, sendError, getPathParam } from "../route-utils.js";

const PATH = "/api/tasks";

export function createTaskRoutes(repo: TaskRepository) {
  return async function handleTasks(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!req.url?.startsWith(PATH)) return false;

    try {
      const user = extractUser(req);
      const method = req.method ?? "GET";

      // GET /api/tasks
      if (method === "GET" && req.url === PATH) {
        requirePermission(user, "tasks:read");
        sendJson(res, 200, { tasks: repo.list() });
        return true;
      }

      // GET /api/tasks/:id
      if (method === "GET") {
        requirePermission(user, "tasks:read");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const task = repo.getById(validateUUID(id, "id"));
        if (!task) {
          sendJson(res, 404, { error: "Task not found" });
          return true;
        }
        sendJson(res, 200, { task });
        return true;
      }

      // POST /api/tasks
      if (method === "POST" && req.url === PATH) {
        requirePermission(user, "tasks:create");
        const body = validateBody(await parseBody(req));
        const goal_id = validateString(body.goal_id, "goal_id");
        validateUUID(goal_id, "goal_id");
        const agent_id = validateOptionalString(body.agent_id, "agent_id");
        if (agent_id) validateUUID(agent_id, "agent_id");
        const title = validateString(body.title, "title", { minLength: 1, maxLength: 500 });
        const description = validateOptionalString(body.description, "description", { maxLength: 5000 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["pending", "in_progress", "review", "completed", "cancelled"] as const,
        });
        const sub_state = validateOptionalString(body.sub_state, "sub_state", {
          enum: ["queued", "initializing", "executing", "summarizing"] as const,
        });
        const priority = validateOptionalNumber(body.priority, "priority", { min: 0, max: 100, integer: true });
        const output = validateOptionalString(body.output, "output", { maxLength: 1_000_000 });
        const depends_on = Array.isArray(body.depends_on) ? body.depends_on as string[] : undefined;

        const task = repo.create({ goal_id, agent_id, title, description, status, sub_state, priority, output, depends_on });
        sendJson(res, 201, { task });
        return true;
      }

      // PATCH /api/tasks/:id
      if (method === "PATCH") {
        requirePermission(user, "tasks:update");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const validId = validateUUID(id, "id");
        const body = validateBody(await parseBody(req));
        const goal_id = validateOptionalString(body.goal_id, "goal_id");
        if (goal_id) validateUUID(goal_id, "goal_id");
        const agent_id = body.agent_id === null ? null : validateOptionalString(body.agent_id, "agent_id");
        if (agent_id) validateUUID(agent_id, "agent_id");
        const title = validateOptionalString(body.title, "title", { minLength: 1, maxLength: 500 });
        const description = validateOptionalString(body.description, "description", { maxLength: 5000 });
        const status = validateOptionalString(body.status, "status", {
          enum: ["pending", "in_progress", "review", "completed", "cancelled"] as const,
        });
        const sub_state = validateOptionalString(body.sub_state, "sub_state", {
          enum: ["queued", "initializing", "executing", "summarizing"] as const,
        });
        const priority = validateOptionalNumber(body.priority, "priority", { min: 0, max: 100, integer: true });
        const output = validateOptionalString(body.output, "output", { maxLength: 1_000_000 });
        const depends_on = Array.isArray(body.depends_on) ? body.depends_on as string[] : undefined;

        const task = repo.update(validId, { goal_id, agent_id, title, description, status, sub_state, priority, output, depends_on });
        if (!task) {
          sendJson(res, 404, { error: "Task not found" });
          return true;
        }
        sendJson(res, 200, { task });
        return true;
      }

      // DELETE /api/tasks/:id
      if (method === "DELETE") {
        requirePermission(user, "tasks:delete");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const deleted = repo.delete(validateUUID(id, "id"));
        if (!deleted) {
          sendJson(res, 404, { error: "Task not found" });
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
