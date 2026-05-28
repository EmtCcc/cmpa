import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TokenManager } from "../src/main/ipc/middleware/token-manager.js";

describe("TokenManager", () => {
  let tmpDir: string;
  let manager: TokenManager;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "token-test-"));
    manager = new TokenManager(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined for missing keys", () => {
    expect(manager.get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves tokens in memory", () => {
    manager.set("api-key", "sk-secret-123");
    expect(manager.get("api-key")).toBe("sk-secret-123");
  });

  it("deletes a key", () => {
    manager.set("key", "value");
    expect(manager.delete("key")).toBe(true);
    expect(manager.get("key")).toBeUndefined();
  });

  it("has() checks key existence", () => {
    manager.set("key", "value");
    expect(manager.has("key")).toBe(true);
    expect(manager.has("missing")).toBe(false);
  });

  it("clears all tokens", () => {
    manager.set("a", "1");
    manager.set("b", "2");
    manager.clear();
    expect(manager.get("a")).toBeUndefined();
    expect(manager.get("b")).toBeUndefined();
  });

  it("does not persist to disk when safeStorage is unavailable", () => {
    manager.set("token", "secret-value");
    // In test environment, safeStorage is typically unavailable
    // Tokens should remain in-memory only — no tokens.enc.json written
    const storePath = join(tmpDir, "tokens.enc.json");
    expect(existsSync(storePath)).toBe(false);
  });

  it("does not crash when persist is not called", () => {
    // Should work fine without persisting
    manager.set("a", "1");
    manager.set("b", "2");
    manager.delete("a");
    expect(manager.get("b")).toBe("2");
  });
});
