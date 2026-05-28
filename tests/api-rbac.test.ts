import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission, getRolePermissions } from "../src/api/middleware/rbac.js";
import type { AuthenticatedUser } from "../src/api/middleware/rbac.js";

const admin: AuthenticatedUser = { id: "u1", role: "admin" };
const manager: AuthenticatedUser = { id: "u2", role: "manager" };
const operator: AuthenticatedUser = { id: "u3", role: "operator" };
const viewer: AuthenticatedUser = { id: "u4", role: "viewer" };

describe("hasPermission", () => {
  it("admin has all permissions", () => {
    expect(hasPermission(admin, "agents:delete")).toBe(true);
    expect(hasPermission(admin, "settings:update")).toBe(true);
    expect(hasPermission(admin, "tasks:assign")).toBe(true);
  });

  it("manager can read and create goals but not delete agents", () => {
    expect(hasPermission(manager, "goals:read")).toBe(true);
    expect(hasPermission(manager, "goals:create")).toBe(true);
    expect(hasPermission(manager, "agents:delete")).toBe(false);
  });

  it("operator can read and update tasks but not delete", () => {
    expect(hasPermission(operator, "tasks:read")).toBe(true);
    expect(hasPermission(operator, "tasks:update")).toBe(true);
    expect(hasPermission(operator, "tasks:delete")).toBe(false);
  });

  it("viewer can only read", () => {
    expect(hasPermission(viewer, "tasks:read")).toBe(true);
    expect(hasPermission(viewer, "tasks:create")).toBe(false);
    expect(hasPermission(viewer, "settings:update")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("throws 401 for unauthenticated", () => {
    expect(() => requirePermission(undefined, "agents:read")).toThrow("Authentication required");
    try {
      requirePermission(undefined, "agents:read");
    } catch (e: any) {
      expect(e.statusCode).toBe(401);
    }
  });

  it("throws 403 for insufficient permissions", () => {
    expect(() => requirePermission(viewer, "agents:create")).toThrow("Insufficient permissions");
    try {
      requirePermission(viewer, "agents:create");
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
    }
  });

  it("does not throw for authorized user", () => {
    expect(() => requirePermission(admin, "agents:delete")).not.toThrow();
  });
});

describe("getRolePermissions", () => {
  it("returns permissions for known role", () => {
    const perms = getRolePermissions("viewer");
    expect(perms).toContain("agents:read");
    expect(perms).not.toContain("agents:create");
  });

  it("returns empty array for unknown role", () => {
    expect(getRolePermissions("unknown" as any)).toEqual([]);
  });
});
