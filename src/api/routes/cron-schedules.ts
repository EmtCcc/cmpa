/**
 * HTTP API routes for /api/cron-schedules
 * Input validation + RBAC permission checks applied.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { CronScheduleRepository } from "../../db/repositories/cron-schedules.js";
import { extractUser } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody, validateString, validateOptionalString, validateOptionalNumber, validateOptionalBoolean, validateUUID } from "../validation.js";
import { parseBody, sendJson, sendError, getPathParam } from "../route-utils.js";

const PATH = "/api/cron-schedules";

export function createCronScheduleRoutes(repo: CronScheduleRepository) {
  return async function handleCronSchedules(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!req.url?.startsWith(PATH)) return false;

    try {
      const user = extractUser(req);
      const method = req.method ?? "GET";

      // GET /api/cron-schedules
      if (method === "GET" && req.url === PATH) {
        requirePermission(user, "tasks:read");
        const schedules = repo.list().map((s) => ({ ...s, enabled: Boolean(s.enabled) }));
        sendJson(res, 200, { schedules });
        return true;
      }

      // GET /api/cron-schedules/:id
      if (method === "GET") {
        requirePermission(user, "tasks:read");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const schedule = repo.getById(validateUUID(id, "id"));
        if (!schedule) {
          sendJson(res, 404, { error: "Schedule not found" });
          return true;
        }
        sendJson(res, 200, { schedule: { ...schedule, enabled: Boolean(schedule.enabled) } });
        return true;
      }

      // POST /api/cron-schedules
      if (method === "POST" && req.url === PATH) {
        requirePermission(user, "tasks:create");
        const body = validateBody(await parseBody(req));
        const name = validateString(body.name, "name", { minLength: 1, maxLength: 200 });
        const cron_expression = validateString(body.cron_expression, "cron_expression", { minLength: 9, maxLength: 50 });
        const template_title = validateString(body.template_title, "template_title", { minLength: 1, maxLength: 500 });
        const template_description = validateOptionalString(body.template_description, "template_description", { maxLength: 5000 });
        const template_goal_id = validateOptionalString(body.template_goal_id, "template_goal_id");
        if (template_goal_id) validateUUID(template_goal_id, "template_goal_id");
        const template_agent_id = validateOptionalString(body.template_agent_id, "template_agent_id");
        if (template_agent_id) validateUUID(template_agent_id, "template_agent_id");
        const template_priority = validateOptionalNumber(body.template_priority, "template_priority", { min: 0, max: 100, integer: true });
        const enabled = validateOptionalBoolean(body.enabled, "enabled");

        const schedule = repo.create({
          name, cron_expression, template_title, template_description,
          template_goal_id, template_agent_id, template_priority,
          enabled: enabled ?? true,
        });
        sendJson(res, 201, { schedule: { ...schedule, enabled: Boolean(schedule.enabled) } });
        return true;
      }

      // PATCH /api/cron-schedules/:id
      if (method === "PATCH") {
        requirePermission(user, "tasks:update");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const validId = validateUUID(id, "id");
        const body = validateBody(await parseBody(req));
        const name = validateOptionalString(body.name, "name", { minLength: 1, maxLength: 200 });
        const cron_expression = validateOptionalString(body.cron_expression, "cron_expression", { minLength: 9, maxLength: 50 });
        const template_title = validateOptionalString(body.template_title, "template_title", { minLength: 1, maxLength: 500 });
        const template_description = body.template_description === null ? null : validateOptionalString(body.template_description, "template_description", { maxLength: 5000 });
        const template_goal_id = body.template_goal_id === null ? null : validateOptionalString(body.template_goal_id, "template_goal_id");
        if (template_goal_id) validateUUID(template_goal_id, "template_goal_id");
        const template_agent_id = body.template_agent_id === null ? null : validateOptionalString(body.template_agent_id, "template_agent_id");
        if (template_agent_id) validateUUID(template_agent_id, "template_agent_id");
        const template_priority = validateOptionalNumber(body.template_priority, "template_priority", { min: 0, max: 100, integer: true });
        const enabled = validateOptionalBoolean(body.enabled, "enabled");

        const schedule = repo.update(validId, {
          name, cron_expression, template_title, template_description,
          template_goal_id, template_agent_id, template_priority, enabled,
        });
        if (!schedule) {
          sendJson(res, 404, { error: "Schedule not found" });
          return true;
        }
        sendJson(res, 200, { schedule: { ...schedule, enabled: Boolean(schedule.enabled) } });
        return true;
      }

      // DELETE /api/cron-schedules/:id
      if (method === "DELETE") {
        requirePermission(user, "tasks:delete");
        const id = getPathParam(req.url, PATH);
        if (!id) return false;
        const deleted = repo.delete(validateUUID(id, "id"));
        if (!deleted) {
          sendJson(res, 404, { error: "Schedule not found" });
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
