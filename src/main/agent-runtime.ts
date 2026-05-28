import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, delimiter } from "node:path";
import { appendFileSync, mkdirSync, existsSync, accessSync, access, constants } from "node:fs";
import { homedir } from "node:os";
import type { AgentRepository } from "../db/repositories/agents.js";

/**
 * Agent Runtime — secure process spawning for agent executables.
 *
 * H4 fix: Restricts agents:spawn to an explicit allowlist of executables.
 * All spawn attempts are logged with full args for audit trail.
 */

/** Canonical allowlist of permitted agent executables. */
const ALLOWED_EXECUTABLES = new Set([
  "claude",
  "codex",
  "opencode",
  "cursor",
  "gemini",
  "node",
  "python3",
  "python",
  "bash",
  "sh",
]);

/**
 * SEC-H1: Blocklist of environment variable keys that enable RCE via
 * dynamic linker injection, runtime flag hijacking, or PATH override.
 *
 * Blocked categories:
 * - Dynamic linker preloading (LD_PRELOAD, LD_LIBRARY_PATH, DYLD_*)
 * - Node/V8 runtime flags (NODE_OPTIONS, V8_OPTIONS, NODE_PATH)
 * - Executable search path override (PATH, PATHEXT)
 * - Electron-specific escalation (ELECTRON_RUN_AS_NODE)
 */
const BLOCKED_ENV_KEYS = new Set([
  // Dynamic linker — Linux/macOS library injection
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "LD_AUDIT",
  "LD_DEBUG",
  "LD_TRACE_LOADED_OBJECTS",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "DYLD_FRAMEWORK_PATH",
  "DYLD_FALLBACK_FRAMEWORK_PATH",
  "DYLD_FALLBACK_LIBRARY_PATH",
  "DYLD_PRINT_TO_FILE",
  // Node/V8 runtime — enables --require, --eval, arbitrary code load
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_EXTRA_CA_CERTS",
  "NODE_REPL_EXTERNAL_MODULE",
  "V8_OPTIONS",
  // Executable search path — hijack resolved binaries
  "PATH",
  "PATHEXT",
  // Electron-specific — run Electron itself as a Node interpreter
  "ELECTRON_RUN_AS_NODE",
  "ELECTRON_NO_ATTACH_CONSOLE",
]);

/** Pattern match for additional dangerous prefixes. */
const BLOCKED_ENV_PREFIXES = ["LD_", "DYLD_"];

function sanitizeEnvKeys(
  env: Record<string, string>,
  log: (stripped: string[]) => void,
): Record<string, string> {
  const stripped: string[] = [];
  const clean: Record<string, string> = {};

  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (
      BLOCKED_ENV_KEYS.has(upper) ||
      BLOCKED_ENV_PREFIXES.some((p) => upper.startsWith(p))
    ) {
      stripped.push(key);
      continue;
    }
    clean[key] = env[key];
  }

  if (stripped.length > 0) log(stripped);
  return clean;
}

/** Canonical allowlist of permitted kill signals (SEC-H2 fix). */
const ALLOWED_SIGNALS = new Set(["SIGTERM", "SIGKILL", "SIGINT"]);

/** Maximum argument length to prevent abuse. */
const MAX_ARGS = 64;

/** Maximum combined command string length. */
const MAX_CMD_LENGTH = 4096;

export interface SpawnRequest {
  executable: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SpawnResult {
  ok: boolean;
  processId?: string;
  pid?: number;
  error?: string;
}

export interface HealthCheckResult {
  agentId: string;
  status: "idle" | "offline" | "error";
  version?: string;
  error?: string;
  checkedAt: string;
}

export interface StatusChangeEvent {
  agentId: string;
  oldStatus: string;
  newStatus: string;
}

interface ManagedProcess {
  id: string;
  child: ChildProcess;
  executable: string;
  args: string[];
  startedAt: string;
}

function getLogPath(): string {
  const dir = join(homedir(), ".agentops", "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "agent-spawn.log");
}

function join(...segments: string[]): string {
  return segments.join("/");
}

function logSpawnAttempt(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + "\n";
  try {
    appendFileSync(getLogPath(), line, "utf-8");
  } catch {
    // Best-effort logging — don't let logging failure block spawn
  }
}

function validateExecutable(executable: string): string | null {
  const base = basename(executable).toLowerCase();
  // Strip .exe/.cmd/.bat extensions for cross-platform matching
  const normalized = base.replace(/\.(exe|cmd|bat)$/i, "");

  if (!ALLOWED_EXECUTABLES.has(normalized) && !ALLOWED_EXECUTABLES.has(base)) {
    return `Executable "${executable}" is not in the allowlist. Permitted: ${[...ALLOWED_EXECUTABLES].join(", ")}`;
  }
  return null;
}

function validateArgs(args: string[]): string | null {
  if (args.length > MAX_ARGS) {
    return `Too many arguments: ${args.length} (max ${MAX_ARGS})`;
  }
  const totalLen = args.reduce((sum, a) => sum + a.length, 0);
  if (totalLen > MAX_CMD_LENGTH) {
    return `Combined argument length ${totalLen} exceeds limit ${MAX_CMD_LENGTH}`;
  }
  // NOTE: shell metacharacters are NOT blocked here because spawn uses shell:false.
  // With shell:false, args are passed as literal strings — no interpretation occurs.
  // The allowlist + shell:false combination is the primary defense against injection.
  return null;
}

function validateSignal(signal: string): string | null {
  if (!ALLOWED_SIGNALS.has(signal)) {
    return `Signal "${signal}" is not in the allowlist. Permitted: ${[...ALLOWED_SIGNALS].join(", ")}`;
  }
  return null;
}

export class AgentRuntime {
  private processes = new Map<string, ManagedProcess>();
  private agentRepo: AgentRepository | null = null;
  private statusListeners: Array<(event: StatusChangeEvent) => void> = [];

  setAgentRepository(repo: AgentRepository): void {
    this.agentRepo = repo;
  }

  onStatusChange(listener: (event: StatusChangeEvent) => void): void {
    this.statusListeners.push(listener);
  }

  spawn(request: SpawnRequest): SpawnResult {
    const id = randomUUID();
    const executable = request.executable;
    const args = request.args ?? [];

    // Validate executable against allowlist
    const exeError = validateExecutable(executable);
    if (exeError) {
      logSpawnAttempt({ event: "spawn_rejected", reason: exeError, request: { executable, args } });
      return { ok: false, error: exeError };
    }

    // Validate arguments
    const argsError = validateArgs(args);
    if (argsError) {
      logSpawnAttempt({ event: "spawn_rejected", reason: argsError, request: { executable, args } });
      return { ok: false, error: argsError };
    }

    // Resolve executable to absolute path from allowlist
    const resolvedExe = this.resolveExecutable(executable);
    if (!resolvedExe) {
      const msg = `Could not resolve executable "${executable}" in PATH`;
      logSpawnAttempt({ event: "spawn_rejected", reason: msg, request: { executable, args } });
      return { ok: false, error: msg };
    }

    // SEC-H1: Sanitize renderer-supplied env — strip dangerous keys before merge
    const sanitizedEnv = request.env
      ? sanitizeEnvKeys(request.env, (stripped) =>
          logSpawnAttempt({ event: "env_keys_stripped", processId: id, strippedKeys: stripped }),
        )
      : {};

    // Spawn with explicit shell:false to prevent shell injection
    const child = spawn(resolvedExe, args, {
      cwd: request.cwd,
      env: { ...process.env, ...sanitizedEnv },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const managed: ManagedProcess = {
      id,
      child,
      executable: resolvedExe,
      args,
      startedAt: new Date().toISOString(),
    };

    this.processes.set(id, managed);

    child.on("exit", (code, signal) => {
      logSpawnAttempt({
        event: "process_exit",
        processId: id,
        executable: resolvedExe,
        args,
        exitCode: code,
        signal,
      });
      this.processes.delete(id);
    });

    child.on("error", (err) => {
      logSpawnAttempt({
        event: "process_error",
        processId: id,
        executable: resolvedExe,
        args,
        error: err.message,
      });
      this.processes.delete(id);
    });

    logSpawnAttempt({
      event: "spawn_success",
      processId: id,
      pid: child.pid,
      executable: resolvedExe,
      args,
      cwd: request.cwd,
    });

    return { ok: true, processId: id, pid: child.pid };
  }

  private resolveExecutable(executable: string): string | null {
    const base = basename(executable).toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");
    if (!ALLOWED_EXECUTABLES.has(base)) return null;

    // If already an absolute path that's accessible, return as-is
    if (executable.startsWith("/") || executable.startsWith("\\")) {
      try {
        accessSync(executable, constants.X_OK);
        return executable;
      } catch {
        return null;
      }
    }

    // Search PATH for the executable
    const pathDirs = (process.env.PATH || "").split(delimiter);
    for (const dir of pathDirs) {
      const candidate = dir + "/" + executable;
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // continue searching
      }
    }
    return null;
  }

  terminate(processId: string, signal: string = "SIGTERM"): boolean {
    const managed = this.processes.get(processId);
    if (!managed) return false;
    const sigError = validateSignal(signal);
    if (sigError) {
      logSpawnAttempt({ event: "terminate_rejected", processId, reason: sigError });
      return false;
    }
    managed.child.kill(signal as NodeJS.Signals);
    logSpawnAttempt({ event: "process_terminated", processId, signal });
    return true;
  }

  list(): Array<{ id: string; executable: string; args: string[]; startedAt: string; pid?: number }> {
    return Array.from(this.processes.values()).map((m) => ({
      id: m.id,
      executable: m.executable,
      args: m.args,
      startedAt: m.startedAt,
      pid: m.child.pid,
    }));
  }

  async healthCheck(agentId: string, executablePath: string, args: string[] = ["--version"]): Promise<HealthCheckResult> {
    const checkedAt = new Date().toISOString();

    const exeError = validateExecutable(executablePath);
    if (exeError) {
      logSpawnAttempt({ event: "health_check", agentId, executable: executablePath, status: "rejected", reason: exeError });
      return this.persistAndEmit(agentId, { agentId, status: "error", error: exeError, checkedAt });
    }

    const resolvedExe = this.resolveExecutable(executablePath);
    if (!resolvedExe) {
      const msg = `Could not resolve executable "${executablePath}" in PATH`;
      logSpawnAttempt({ event: "health_check", agentId, executable: executablePath, status: "offline", reason: msg });
      return this.persistAndEmit(agentId, { agentId, status: "offline", error: msg, checkedAt });
    }

    const canAccess = await new Promise<boolean>((resolve) => {
      access(resolvedExe, constants.X_OK, (err) => resolve(!err));
    });

    if (!canAccess) {
      logSpawnAttempt({ event: "health_check", agentId, executable: resolvedExe, status: "offline", reason: "executable not found or not executable" });
      return this.persistAndEmit(agentId, { agentId, status: "offline", error: `Executable "${resolvedExe}" not found or not executable`, checkedAt });
    }

    const HEALTH_CHECK_TIMEOUT_MS = 5000;

    const result = await new Promise<HealthCheckResult>((resolve) => {
      let resolved = false;
      let stdout = "";

      const child = spawn(resolvedExe, args, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill("SIGKILL");
          logSpawnAttempt({ event: "health_check", agentId, executable: resolvedExe, status: "error", reason: "timeout" });
          resolve({ agentId, status: "error", error: "Health check timed out after 5s", checkedAt });
        }
      }, HEALTH_CHECK_TIMEOUT_MS);

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        const status = err.code === "ENOENT" ? "offline" : "error";
        logSpawnAttempt({ event: "health_check", agentId, executable: resolvedExe, status, reason: err.message });
        resolve({ agentId, status, error: err.message, checkedAt });
      });

      child.on("exit", (code) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);

        if (code === 0) {
          const version = stdout.trim().split("\n")[0] || undefined;
          logSpawnAttempt({ event: "health_check", agentId, executable: resolvedExe, status: "idle", version });
          resolve({ agentId, status: "idle", version, checkedAt });
        } else {
          logSpawnAttempt({ event: "health_check", agentId, executable: resolvedExe, status: "error", reason: `exit code ${code}` });
          resolve({ agentId, status: "error", error: `Process exited with code ${code}`, checkedAt });
        }
      });
    });

    return this.persistAndEmit(agentId, result);
  }

  private persistAndEmit(agentId: string, result: HealthCheckResult): HealthCheckResult {
    if (!this.agentRepo) return result;

    const agent = this.agentRepo.getById(agentId);
    if (agent) {
      const oldStatus = agent.status;
      if (oldStatus !== result.status) {
        this.agentRepo.updateStatus(agentId, result.status);
        for (const listener of this.statusListeners) {
          listener({ agentId, oldStatus, newStatus: result.status });
        }
      }
    }

    return result;
  }

  terminateAll(signal: string = "SIGTERM"): void {
    const sigError = validateSignal(signal);
    if (sigError) {
      logSpawnAttempt({ event: "terminate_all_rejected", reason: sigError });
      return;
    }
    for (const [id, managed] of this.processes) {
      managed.child.kill(signal as NodeJS.Signals);
      logSpawnAttempt({ event: "process_terminated", processId: id, reason: "terminateAll", signal });
    }
    this.processes.clear();
  }
}

export { ALLOWED_EXECUTABLES, ALLOWED_SIGNALS };
