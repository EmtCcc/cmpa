/**
 * Authentication middleware for HTTP API routes.
 * Extracts and validates the authenticated user from request headers.
 */

import type { IncomingMessage } from "node:http";
import type { AuthenticatedUser, Role } from "./rbac.js";

const VALID_ROLES: readonly Role[] = ["admin", "manager", "operator", "viewer"];

export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Extract authenticated user from request headers.
 * Expects X-User-Id and X-User-Role headers.
 * In production, replace with proper JWT/session validation.
 */
export function extractUser(req: IncomingMessage): AuthenticatedUser {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];

  if (!userId || typeof userId !== "string") {
    throw new AuthenticationError("Missing or invalid X-User-Id header");
  }

  if (!userRole || typeof userRole !== "string") {
    throw new AuthenticationError("Missing or invalid X-User-Role header");
  }

  const role = userRole.toLowerCase() as Role;
  if (!VALID_ROLES.includes(role)) {
    throw new AuthenticationError(`Invalid role: ${userRole}`);
  }

  return { id: userId, role };
}
