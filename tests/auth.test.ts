import { describe, it, expect, beforeEach, vi } from "vitest";

// Module-level state is hard to reset across tests since auth.ts uses
// module-scoped `failedAttempts` and `lockedUntil`. We re-import with
// `vi.resetModules()` in beforeEach to get a fresh module each time.

describe("auth:login rate limiting", () => {
  let login: (secret: string) => import("../src/main/auth.js").LoginResult;

  beforeEach(async () => {
    vi.resetModules();
    process.env.IPC_AUTH_SECRET = "test-secret";
    process.env.IPC_ADMIN_SECRET = "";
    const mod = await import("../src/main/auth.js");
    login = mod.login;
  });

  it("allows login with correct secret", () => {
    const result = login("test-secret");
    expect(result.ok).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.role).toBe("user");
  });

  it("rejects wrong secret", () => {
    const result = login("wrong-secret");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid credentials");
  });

  it("locks out after 5 failed attempts", () => {
    for (let i = 0; i < 5; i++) {
      login("wrong");
    }

    const result = login("wrong");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Too many attempts/);
  });

  it("includes retry-after seconds in lockout message", () => {
    for (let i = 0; i < 5; i++) {
      login("wrong");
    }

    const result = login("test-secret"); // even correct secret is blocked
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Retry after \d+s/);
  });

  it("successful login resets failure counter", () => {
    // 4 failures (below threshold)
    for (let i = 0; i < 4; i++) {
      login("wrong");
    }

    // Success resets
    const ok = login("test-secret");
    expect(ok.ok).toBe(true);

    // Can attempt again without lockout
    const fail = login("wrong");
    expect(fail.ok).toBe(false);
    expect(fail.error).toBe("Invalid credentials"); // not "Too many attempts"
  });

  it("rejects empty secret without counting as failure", () => {
    const result = login("");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Secret is required");

    // Should not contribute to rate limit — 5 more wrong attempts
    // should still trigger lockout (not 4)
    for (let i = 0; i < 5; i++) {
      login("wrong");
    }
    const locked = login("test-secret");
    expect(locked.ok).toBe(false);
    expect(locked.error).toMatch(/Too many attempts/);
  });

  it("returns error when IPC_AUTH_SECRET is not configured", async () => {
    vi.resetModules();
    delete process.env.IPC_AUTH_SECRET;
    const mod = await import("../src/main/auth.js");
    const result = mod.login("anything");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });
});
