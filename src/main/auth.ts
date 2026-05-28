import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * IPC authentication module.
 *
 * Provides session-token–based auth for Electron IPC handlers.
 * A shared secret is required at login; on success a random session
 * token is issued and must accompany every subsequent IPC call.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface Session {
  token: string;
  role: "admin" | "user";
  createdAt: number;
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  role?: "admin" | "user";
  error?: string;
}

// ── State ──────────────────────────────────────────────────────────

/** Active sessions keyed by token. */
const sessions = new Map<string, Session>();

/**
 * Shared secret required for login.
 * Loaded once from IPC_AUTH_SECRET env var at startup.
 * If unset, login is **blocked** (fail-closed).
 */
const SHARED_SECRET = process.env.IPC_AUTH_SECRET ?? "";

/**
 * Optional admin secret. If set, login with this secret grants admin role.
 * If unset, all logins receive "user" role (admin must be assigned server-side).
 */
const ADMIN_SECRET = process.env.IPC_ADMIN_SECRET ?? "";

/** Token lifetime in ms (default 8 hours). */
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Attempt login with a secret.
 * Role is determined server-side: admin secret → admin, shared secret → user.
 * The client cannot control which role is assigned.
 */
export function login(secret: string): LoginResult {
  if (!SHARED_SECRET) {
    return { ok: false, error: "Auth not configured (IPC_AUTH_SECRET unset)" };
  }

  if (!secret || typeof secret !== "string") {
    return { ok: false, error: "Secret is required" };
  }

  // Determine role by which secret was provided (server-side decision)
  let role: "admin" | "user" = "user";
  let secretMatched = false;

  // Check admin secret first (if configured)
  if (ADMIN_SECRET) {
    const adminBuf = Buffer.from(secret, "utf8");
    const adminExpectedBuf = Buffer.from(ADMIN_SECRET, "utf8");
    if (
      adminBuf.length === adminExpectedBuf.length &&
      timingSafeEqual(adminBuf, adminExpectedBuf)
    ) {
      role = "admin";
      secretMatched = true;
    }
  }

  // Fall back to shared secret check
  if (!secretMatched) {
    const secretBuf = Buffer.from(secret, "utf8");
    const expectedBuf = Buffer.from(SHARED_SECRET, "utf8");
    if (
      secretBuf.length !== expectedBuf.length ||
      !timingSafeEqual(secretBuf, expectedBuf)
    ) {
      return { ok: false, error: "Invalid credentials" };
    }
    secretMatched = true;
  }

  // Generate cryptographically random session token
  const token = randomBytes(32).toString("hex");
  const session: Session = {
    token,
    role,
    createdAt: Date.now(),
  };

  sessions.set(token, session);
  return { ok: true, token, role: session.role };
}

/**
 * Validate a session token. Returns the session or null.
 */
export function validateSession(token: string): Session | null {
  if (!token || typeof token !== "string") return null;

  const session = sessions.get(token);
  if (!session) return null;

  // Check TTL
  if (Date.now() - session.createdAt > TOKEN_TTL_MS) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Revoke a session token (logout).
 */
export function logout(token: string): boolean {
  return sessions.delete(token);
}

/**
 * Revoke all sessions (e.g. on app shutdown).
 */
export function revokeAll(): void {
  sessions.clear();
}

/**
 * Check whether IPC auth is configured (shared secret is set).
 */
export function isConfigured(): boolean {
  return SHARED_SECRET.length > 0;
}
