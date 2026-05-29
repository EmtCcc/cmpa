import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename, delimiter } from "node:path";
import { appendFileSync, mkdirSync, existsSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { EventEmitter } from "node:events";
import { ALLOWED_EXECUTABLES, ALLOWED_SIGNALS, sanitizeEnvKeys } from "./agent-runtime.js";

/**
 * ProcessPool — manages N concurrent agent processes.
 *
 * Each slot holds one agent process. The pool enforces a max parallel limit
 * and emits events when slots become available or processes crash.
 */

interface PoolSlot {
  id: string;
  orchestrationTaskId: string;
  agentId: string;
  child: ChildProcess;
  executable: string;
  args: string[];
  startedAt: string;
  stdout: string;
  stderr: string;
}

export interface PoolSlotInfo {
  id: string;
  orchestrationTaskId: string;
  agentId: string;
  pid?: number;
  executable: string;
  startedAt: string;
}

export interface SlotEvent {
  slotId: string;
  orchestrationTaskId: string;
  agentId: string;
}

export interface SlotExitEvent extends SlotEvent {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

export interface SlotErrorEvent extends SlotEvent {
  error: string;
}

function getLogPath(): string {
  const dir = join(homedir(), ".agentops", "logs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "agent-spawn.log");
}

function join(...segments: string[]): string {
  return segments.join("/");
}

function logEntry(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + "\n";
  try {
    appendFileSync(getLogPath(), line, "utf-8");
  } catch {
    // Best-effort
  }
}

export class ProcessPool extends EventEmitter {
  private slots = new Map<string, PoolSlot>();
  private _maxParallel: number;

  constructor(maxParallel: number = 4) {
    super();
    this._maxParallel = Math.max(1, maxParallel);
  }

  get maxParallel(): number {
    return this._maxParallel;
  }

  set maxParallel(value: number) {
    this._maxParallel = Math.max(1, value);
  }

  /** Number of currently occupied slots. */
  get activeCount(): number {
    return this.slots.size;
  }

  /** Whether the pool has capacity for another process. */
  get hasCapacity(): boolean {
    return this.slots.size < this._maxParallel;
  }

  /** List active slot info. */
  list(): PoolSlotInfo[] {
    return Array.from(this.slots.values()).map((s) => ({
      id: s.id,
      orchestrationTaskId: s.orchestrationTaskId,
      agentId: s.agentId,
      pid: s.child.pid ?? undefined,
      executable: s.executable,
      startedAt: s.startedAt,
    }));
  }

  /**
   * Acquire a slot and spawn a process.
   * Returns the slot id on success, or null if pool is full.
   *
   * The caller provides the executable and args; the pool handles
   * lifecycle (exit, error) and emits events.
   */
  acquire(
    orchestrationTaskId: string,
    agentId: string,
    executable: string,
    args: string[],
    cwd?: string,
    env?: Record<string, string>,
  ): string | null {
    if (!this.hasCapacity) return null;

    const id = randomUUID();

    // SEC-H1: Sanitize renderer-supplied env — strip dangerous keys before merge
    const sanitizedEnv = env
      ? sanitizeEnvKeys(env, (stripped) =>
          logEntry({ event: "env_keys_stripped", slotId: id, orchestrationTaskId, agentId, strippedKeys: stripped }),
        )
      : {};

    const child = spawn(executable, args, {
      cwd,
      env: { ...process.env, ...sanitizedEnv },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const slot: PoolSlot = {
      id,
      orchestrationTaskId,
      agentId,
      child,
      executable,
      args,
      startedAt: new Date().toISOString(),
      stdout: "",
      stderr: "",
    };

    // Capture stdout/stderr for result handoff
    child.stdout?.on("data", (chunk: Buffer) => {
      slot.stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      slot.stderr += chunk.toString();
    });

    this.slots.set(id, slot);

    child.on("exit", (code, signal) => {
      this.slots.delete(id);
      logEntry({ event: "pool_slot_exit", slotId: id, orchestrationTaskId, agentId, exitCode: code, signal });
      this.emit("exit", {
        slotId: id,
        orchestrationTaskId,
        agentId,
        exitCode: code,
        signal: signal ?? null,
        stdout: slot.stdout,
        stderr: slot.stderr,
      } satisfies SlotExitEvent);
      this.emit("available");
    });

    child.on("error", (err) => {
      this.slots.delete(id);
      logEntry({ event: "pool_slot_error", slotId: id, orchestrationTaskId, agentId, error: err.message });
      this.emit("error", { slotId: id, orchestrationTaskId, agentId, error: err.message } satisfies SlotErrorEvent);
      this.emit("available");
    });

    logEntry({ event: "pool_slot_acquired", slotId: id, orchestrationTaskId, agentId, pid: child.pid, executable });
    return id;
  }

  /** Release a specific slot — kills the process if still running. */
  release(slotId: string, signal: string = "SIGTERM"): boolean {
    const slot = this.slots.get(slotId);
    if (!slot) return false;

    const sigError = this.validateSignal(signal);
    if (sigError) return false;

    slot.child.kill(signal as NodeJS.Signals);
    logEntry({ event: "pool_slot_released", slotId, signal });
    return true;
  }

  /** Release all slots. */
  releaseAll(signal: string = "SIGTERM"): void {
    const sigError = this.validateSignal(signal);
    if (sigError) return;

    for (const [id, slot] of this.slots) {
      slot.child.kill(signal as NodeJS.Signals);
      logEntry({ event: "pool_slot_released", slotId: id, reason: "releaseAll", signal });
    }
    this.slots.clear();
  }

  /** Check if a specific slot is still alive. */
  isAlive(slotId: string): boolean {
    return this.slots.has(slotId);
  }

  private validateSignal(signal: string): string | null {
    if (!ALLOWED_SIGNALS.has(signal)) {
      return `Signal "${signal}" is not in the allowlist.`;
    }
    return null;
  }
}
