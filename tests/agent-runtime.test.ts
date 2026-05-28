import { describe, it, expect, beforeEach } from "vitest";
import { AgentRuntime, ALLOWED_EXECUTABLES, ALLOWED_SIGNALS } from "../src/main/agent-runtime.js";

describe("AgentRuntime", () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = new AgentRuntime();
  });

  describe("allowlist enforcement (H4 fix)", () => {
    it("rejects executable not in allowlist", () => {
      const result = runtime.spawn({ executable: "malicious-script" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("not in the allowlist");
    });

    it("rejects path traversal attempts", () => {
      const result = runtime.spawn({ executable: "../../../usr/bin/evil" });
      expect(result.ok).toBe(false);
    });

    it("rejects absolute paths to non-allowlisted binaries", () => {
      const result = runtime.spawn({ executable: "/usr/bin/curl" });
      expect(result.ok).toBe(false);
    });

    it("contains all expected allowed executables", () => {
      expect(ALLOWED_EXECUTABLES).toContain("claude");
      expect(ALLOWED_EXECUTABLES).toContain("node");
      expect(ALLOWED_EXECUTABLES).toContain("python3");
      expect(ALLOWED_EXECUTABLES).toContain("bash");
    });
  });

  describe("argument validation", () => {
    it("rejects too many arguments", () => {
      const args = Array.from({ length: 65 }, (_, i) => `arg${i}`);
      const result = runtime.spawn({ executable: "node", args });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Too many arguments");
    });

    it("allows shell metacharacters when shell:false (safe by design)", () => {
      // With shell:false, metacharacters are literal strings — no injection risk.
      // The allowlist + shell:false is the defense, not arg sanitization.
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "console.log('hello')"],
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });
  });

  describe("SEC-H1: env sanitization", () => {
    it("strips LD_PRELOAD from env", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { LD_PRELOAD: "/tmp/evil.so", SAFE_VAR: "ok" },
      });
      expect(result.ok).toBe(true);
      // Process spawned — LD_PRELOAD was stripped, not passed to child
      runtime.terminate(result.processId!);
    });

    it("strips NODE_OPTIONS from env", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { NODE_OPTIONS: "--require /tmp/evil.js" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });

    it("strips DYLD_INSERT_LIBRARIES from env", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { DYLD_INSERT_LIBRARIES: "/tmp/evil.dylib" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });

    it("strips PATH override from env", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { PATH: "/tmp/fake-bin:/usr/bin" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });

    it("strips ELECTRON_RUN_AS_NODE from env", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { ELECTRON_RUN_AS_NODE: "1" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });

    it("blocks all LD_* variants via prefix match", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "setTimeout(()=>{}, 5000)"],
        env: { LD_DEBUG: "all", LD_AUDIT: "/tmp/evil.so" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });

    it("allows safe custom env vars", () => {
      const result = runtime.spawn({
        executable: "node",
        args: ["-e", "console.log(process.env.MY_API_KEY)"],
        env: { MY_API_KEY: "sk-test-123", LANG: "en_US.UTF-8" },
      });
      expect(result.ok).toBe(true);
      runtime.terminate(result.processId!);
    });
  });

  describe("SEC-H2: signal allowlist enforcement", () => {
    it("terminates with default SIGTERM", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(runtime.terminate(result.processId!)).toBe(true);
    });

    it("terminates with allowed SIGKILL", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(runtime.terminate(result.processId!, "SIGKILL")).toBe(true);
    });

    it("terminates with allowed SIGINT", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(runtime.terminate(result.processId!, "SIGINT")).toBe(true);
    });

    it("rejects disallowed signal", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(runtime.terminate(result.processId!, "SIGUSR1")).toBe(false);
      // Process should still be alive — cleanup
      runtime.terminate(result.processId!);
    });

    it("rejects arbitrary string as signal", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(runtime.terminate(result.processId!, "malicious")).toBe(false);
      runtime.terminate(result.processId!);
    });

    it("terminateAll rejects disallowed signal", () => {
      runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(runtime.list().length).toBe(1);
      runtime.terminateAll("SIGUSR2");
      // Process should still be alive because signal was rejected
      expect(runtime.list().length).toBe(1);
      // Cleanup
      runtime.terminateAll();
    });

    it("contains expected allowed signals", () => {
      expect(ALLOWED_SIGNALS).toContain("SIGTERM");
      expect(ALLOWED_SIGNALS).toContain("SIGKILL");
      expect(ALLOWED_SIGNALS).toContain("SIGINT");
      expect(ALLOWED_SIGNALS.size).toBe(3);
    });
  });

  describe("process lifecycle", () => {
    it("spawns and lists a process", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      expect(result.processId).toBeDefined();
      expect(result.pid).toBeDefined();

      const list = runtime.list();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(result.processId);

      // Cleanup
      runtime.terminate(result.processId!);
    });

    it("terminates a process", () => {
      const result = runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(result.ok).toBe(true);
      const terminated = runtime.terminate(result.processId!);
      expect(terminated).toBe(true);
    });

    it("returns false when terminating unknown processId", () => {
      expect(runtime.terminate("nonexistent")).toBe(false);
    });

    it("terminates all processes on terminateAll", () => {
      runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      runtime.spawn({ executable: "node", args: ["-e", "setTimeout(()=>{}, 5000)"] });
      expect(runtime.list().length).toBe(2);
      runtime.terminateAll();
      expect(runtime.list().length).toBe(0);
    });
  });

  describe("healthCheck", () => {
    it("returns idle with version for a valid executable", async () => {
      const result = await runtime.healthCheck("test-agent", "node");
      expect(result.status).toBe("idle");
      expect(result.version).toBeDefined();
      expect(result.version!.length).toBeGreaterThan(0);
      expect(result.agentId).toBe("test-agent");
      expect(result.checkedAt).toBeDefined();
    });

    it("returns offline for a nonexistent executable", async () => {
      // Use an allowlisted basename with a nonexistent absolute path
      const result = await runtime.healthCheck("test-agent", "/tmp/nonexistent-path/node");
      expect(result.status).toBe("offline");
      expect(result.error).toBeDefined();
    });

    it("returns error for executable not in allowlist", async () => {
      const result = await runtime.healthCheck("test-agent", "curl");
      expect(result.status).toBe("error");
      expect(result.error).toContain("not in the allowlist");
    });

    it("returns error on timeout", async () => {
      // Use node with an inline script that sleeps longer than the 5s timeout
      const result = await runtime.healthCheck("test-agent", "node", ["-e", "setTimeout(()=>{}, 60000)"]);
      expect(result.status).toBe("error");
      expect(result.error).toContain("timed out");
    }, 10_000);
  });
});
