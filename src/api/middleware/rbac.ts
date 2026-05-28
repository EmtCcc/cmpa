/**
 * Role-Based Access Control (RBAC) middleware for HTTP API routes.
 * Enforces permission checks beyond simple authentication.
 */

export type Role = "admin" | "manager" | "operator" | "viewer";

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export type Permission =
  | "agents:read"
  | "agents:create"
  | "agents:update"
  | "agents:delete"
  | "goals:read"
  | "goals:create"
  | "goals:update"
  | "goals:delete"
  | "tasks:read"
  | "tasks:create"
  | "tasks:update"
  | "tasks:delete"
  | "tasks:assign"
  | "settings:read"
  | "settings:update";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "agents:read", "agents:create", "agents:update", "agents:delete",
    "goals:read", "goals:create", "goals:update", "goals:delete",
    "tasks:read", "tasks:create", "tasks:update", "tasks:delete", "tasks:assign",
    "settings:read", "settings:update",
  ],
  manager: [
    "agents:read",
    "goals:read", "goals:create", "goals:update",
    "tasks:read", "tasks:create", "tasks:update", "tasks:delete", "tasks:assign",
    "settings:read",
  ],
  operator: [
    "agents:read",
    "goals:read",
    "tasks:read", "tasks:create", "tasks:update",
    "settings:read",
  ],
  viewer: [
    "agents:read",
    "goals:read",
    "tasks:read",
    "settings:read",
  ],
};

export function hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[user.role];
  return perms !== undefined && perms.includes(permission);
}

export function requirePermission(user: AuthenticatedUser | undefined, permission: Permission): void {
  if (!user) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }
  if (!hasPermission(user, permission)) {
    throw Object.assign(
      new Error(`Insufficient permissions: requires ${permission}`),
      { statusCode: 403 },
    );
  }
}

export function getRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
