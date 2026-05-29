import { app, BrowserWindow, ipcMain, session, Menu } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import * as auth from "./main/auth.js";
import { AgentRuntime } from "./main/agent-runtime.js";
import { registerAgentController } from "./main/ipc/controllers/agent.controller.js";
import { Orchestrator } from "./main/orchestrator.js";
import { CronScheduler } from "./main/cron-scheduler.js";
import { parseCron, nextTriggerTimes } from "./main/cron-parser.js";
import { getAnalyticsConfig, startAnalytics, track, identify, optOut, optIn } from "./analytics.js";
import { IPC_CHANNELS } from "./shared/constants.js";
import type { IpcHandler, IpcChannel } from "./shared/ipc-contracts.js";
import { createConnection } from "./db/index.js";
import { AgentRepository, GoalRepository, TaskRepository, TaskLogRepository, CronScheduleRepository, TaskHandoffRepository, WorkflowRepository } from "./db/index.js";
import type { WorkflowDefinition } from "./shared/types.js";
import { validateCreateInput, validateUpdateInput, AgentValidationError } from "./main/agent-validation.js";

// Security: disable hardware acceleration for headless/testing scenarios
// app.disableHardwareAcceleration();

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

/** M-5 defense-in-depth: strip HTML tags and cap length on renderer-supplied log messages. */
const LOG_MSG_MAX_LEN = 4096;
const ALLOWED_LOG_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);

function sanitizeLogMessage(msg: unknown): string {
  if (typeof msg !== "string") return String(msg ?? "").slice(0, LOG_MSG_MAX_LEN);
  // Strip HTML/script tags, then cap length
  const stripped = msg.replace(/<[^>]*>/g, "");
  return stripped.slice(0, LOG_MSG_MAX_LEN);
}

function sanitizeLogLevel(level: unknown): string {
  if (typeof level !== "string" || !ALLOWED_LOG_LEVELS.has(level)) return "info";
  return level;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  isDev ? "connect-src 'self' ws://localhost:*" : "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP],
      },
    });
  });
}

/**
 * Harden session-level security policies.
 * Must be called before any windows are created.
 */
function applySecurityPolicies(): void {
  // Block unnecessary permission requests (camera, microphone, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // Block permission checks too (consistent with request handler)
  session.defaultSession.setPermissionCheckHandler(() => false);

  // Prevent navigation away from the app's origin
  // This blocks phishing via links that open in the same window
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      const parsed = new URL(url);
      // Only allow file:// protocol for local app content
      if (parsed.protocol !== "file:") {
        event.preventDefault();
      }
    });

    // Block window.open() — all new window attempts are denied
    contents.setWindowOpenHandler(() => ({ action: "deny" }));

    // Disable webview tag entirely
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}

function buildMenu(win: BrowserWindow): Menu {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" as const },
            { type: "separator" as const },
            { role: "hide" as const },
            { role: "hideOthers" as const },
            { role: "unhide" as const },
            { type: "separator" as const },
            { role: "quit" as const },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Task",
          accelerator: "CmdOrCtrl+T",
          click: () => win.webContents.send("menu:new-task"),
        },
        {
          label: "New Goal",
          accelerator: "CmdOrCtrl+N",
          click: () => win.webContents.send("menu:new-goal"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Search",
          accelerator: "CmdOrCtrl+K",
          click: () => win.webContents.send("menu:focus-search"),
        },
        {
          label: "Focus Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => win.webContents.send("menu:focus-sidebar"),
        },
        {
          label: "Focus Logs",
          accelerator: "CmdOrCtrl+L",
          click: () => win.webContents.send("menu:focus-logs"),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
            ]
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "AgentOps Desktop",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, "renderer", "index.html"));
  }

  return win;
}

/**
 * Extract session from an IPC event's token argument.
 * Returns the validated session or throws.
 */
function requireAuth(token: string, requiredRole?: "admin" | "user"): auth.Session {
  const session = auth.validateSession(token);
  if (!session) {
    throw new Error("Unauthorized: valid session token required");
  }
  if (requiredRole === "admin" && session.role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }
  return session;
}

/**
 * Register a type-safe IPC handler.
 * The channel name and handler signature are enforced by the IpcRequestMap contract.
 */
function handle<C extends IpcChannel>(channel: C, handler: IpcHandler<C>): void {
  ipcMain.handle(channel, (_event, ...args) => handler(...args as never));
}

const agentRuntime = new AgentRuntime();
let orchestrator: Orchestrator;
let cronScheduler: CronScheduler;

function registerIPC(): { agents: AgentRepository } {
  // ── Public (unauthenticated) handlers ──

  handle("app:version", () => app.getVersion());
  handle("app:platform", () => process.platform);

  handle("auth:status", () => ({
    configured: auth.isConfigured(),
  }));

  handle("auth:login", (secret) => {
    return auth.login(secret);
  });

  handle("auth:logout", (token) => {
    return { ok: auth.logout(token) };
  });

  // Analytics — public, no auth required
  handle("analytics:config", () => {
    return getAnalyticsConfig();
  });

  handle("analytics:track", (event, properties) => {
    track(event, properties);
    return { ok: true };
  });

  handle("analytics:identify", (distinctId, properties) => {
    identify(distinctId, properties);
    return { ok: true };
  });

  handle("analytics:optOut", () => {
    optOut();
    return { ok: true };
  });

  handle("analytics:optIn", () => {
    optIn();
    return { ok: true };
  });

  // ── DB Entity CRUD (type-safe via contract) ──

  const db = createConnection();
  const agents = new AgentRepository(db);
  const goals = new GoalRepository(db);
  const tasks = new TaskRepository(db);
  const taskLogs = new TaskLogRepository(db);

  // Agents — with input validation and path safety
  handle("agents:list", () => agents.list());
  handle("agents:get", (id) => agents.getById(id));
  handle("agents:create", (input) => {
    try {
      const validated = validateCreateInput(input as unknown as Record<string, unknown>);
      return { ok: true, data: agents.create(validated) };
    } catch (e) {
      if (e instanceof AgentValidationError) {
        return { ok: false, error: `${e.field}: ${e.message}` };
      }
      return { ok: false, error: (e as Error).message };
    }
  });
  handle("agents:update", (id, input) => {
    try {
      const validated = validateUpdateInput(input as unknown as Record<string, unknown>);
      const agent = agents.update(id, validated);
      if (!agent) return { ok: false, error: "Agent not found" };
      return { ok: true, data: agent };
    } catch (e) {
      if (e instanceof AgentValidationError) {
        return { ok: false, error: `${e.field}: ${e.message}` };
      }
      return { ok: false, error: (e as Error).message };
    }
  });
  handle("agents:delete", (id) => {
    if (!agents.delete(id)) return { ok: false, error: "Agent not found" };
    return { ok: true, data: true };
  });

  // Goals
  handle("goals:list", () => goals.list());
  handle("goals:get", (id) => goals.getById(id));
  handle("goals:create", (input) => {
    try { return { ok: true, data: goals.create(input) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  handle("goals:update", (id, input) => {
    const goal = goals.update(id, input);
    if (!goal) return { ok: false, error: "Goal not found" };
    return { ok: true, data: goal };
  });
  handle("goals:delete", (id) => {
    if (!goals.delete(id)) return { ok: false, error: "Goal not found" };
    return { ok: true, data: true };
  });

  // Tasks
  handle("tasks:list", (token) => {
    requireAuth(token, "user");
    return tasks.list();
  });
  handle("tasks:get", (id) => tasks.getById(id));
  handle("tasks:create", (input) => {
    try { return { ok: true, data: tasks.create(input) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  handle("tasks:update", (id, input) => {
    const task = tasks.update(id, input);
    if (!task) return { ok: false, error: "Task not found" };
    return { ok: true, data: task };
  });
  handle("tasks:delete", (id) => {
    if (!tasks.delete(id)) return { ok: false, error: "Task not found" };
    return { ok: true, data: true };
  });
  handle("tasks:move", (token, taskId, newStatus) => {
    requireAuth(token, "user");
    const task = tasks.update(taskId, { status: newStatus });
    if (!task) return { ok: false, error: "Task not found" };
    // Cancel orchestration if task is being cancelled and is currently running
    if (newStatus === "cancelled" && orchestrator) {
      const orchTasks = orchestrator.status().tasks;
      for (const ot of orchTasks) {
        if (ot.taskId === taskId && (ot.state === "running" || ot.state === "assigned" || ot.state === "pending")) {
          orchestrator.cancel(ot.id);
          break;
        }
      }
    }
    return { ok: true, data: task };
  });

  // Task Logs — sanitize renderer-supplied input (M-5 defense-in-depth)
  handle("task-logs:list", (taskId) => taskLogs.listByTask(taskId));
  handle("task-logs:create", (input) => {
    try {
      const sanitized = {
        ...input,
        message: sanitizeLogMessage(input.message),
        level: sanitizeLogLevel(input.level),
      };
      return { ok: true, data: taskLogs.create(sanitized) };
    }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });

  // Agent runtime — IPC-only, no HTTP exposure. All spawns go through allowlist.
  agentRuntime.setAgentRepository(agents);
  agentRuntime.onStatusChange(({ agentId, oldStatus, newStatus }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send(IPC_CHANNELS.AGENT_STATUS_CHANGED, { agentId, oldStatus, newStatus });
    }
  });
  registerAgentController(agentRuntime, agents, () => BrowserWindow.getAllWindows()[0] ?? null);

  // ── Orchestration Engine ──
  const handoffs = new TaskHandoffRepository(db);
  orchestrator = new Orchestrator(agents, tasks, handoffs, () => BrowserWindow.getAllWindows()[0] ?? null);

  handle("orchestration:enqueue", (input) => {
    try {
      const task = orchestrator.enqueue(input);
      return { ok: true, data: task };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  handle("orchestration:cancel", (orchestrationTaskId) => {
    const result = orchestrator.cancel(orchestrationTaskId);
    return { ok: result, data: result, error: result ? undefined : "Task not found or not cancellable" } as never;
  });

  handle("orchestration:status", () => {
    return orchestrator.status();
  });

  handle("orchestration:setMaxParallel", (max) => {
    orchestrator.maxParallel = max;
    return { ok: true };
  });

  // ── Cron Schedules ──
  const cronSchedules = new CronScheduleRepository(db);

  handle("cron-schedules:list", () => {
    return cronSchedules.list().map((s) => ({ ...s, enabled: Boolean(s.enabled) }));
  });

  handle("cron-schedules:get", (id) => {
    const s = cronSchedules.getById(id);
    return s ? { ...s, enabled: Boolean(s.enabled) } : undefined;
  });

  handle("cron-schedules:create", (input) => {
    try {
      const schedule = cronSchedules.create(input);
      // Compute next_trigger_at from cron expression
      try {
        const cron = parseCron(schedule.cron_expression);
        const nexts = nextTriggerTimes(cron, new Date(), 1);
        if (nexts.length > 0) {
          cronSchedules.update(schedule.id, { next_trigger_at: nexts[0].toISOString() });
        }
      } catch { /* invalid cron, leave next_trigger_at null */ }
      const updated = cronSchedules.getById(schedule.id)!;
      return { ok: true, data: { ...updated, enabled: Boolean(updated.enabled) } };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  handle("cron-schedules:update", (id, input) => {
    try {
      // If cron_expression changed, recompute next_trigger_at
      if (input.cron_expression) {
        try {
          const cron = parseCron(input.cron_expression);
          const nexts = nextTriggerTimes(cron, new Date(), 1);
          if (nexts.length > 0) {
            (input as Record<string, unknown>).next_trigger_at = nexts[0].toISOString();
          }
        } catch { /* invalid cron, leave as-is */ }
      }
      const schedule = cronSchedules.update(id, input);
      if (!schedule) return { ok: false, error: "Schedule not found" };
      return { ok: true, data: { ...schedule, enabled: Boolean(schedule.enabled) } };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  handle("cron-schedules:delete", (id) => {
    if (!cronSchedules.delete(id)) return { ok: false, error: "Schedule not found" };
    return { ok: true, data: true };
  });

  handle("cron-schedules:trigger", (id) => {
    const result = cronScheduler.triggerNow(id);
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, data: result };
  });

  handle("cron-schedules:logs", (limit) => {
    return cronScheduler.getLogs(limit);
  });

  // ── Workflows ──
  const workflows = new WorkflowRepository(db);

  handle("workflows:list", () => workflows.list());
  handle("workflows:get", (id) => workflows.getById(id));
  handle("workflows:create", (input) => {
    try {
      const def = JSON.stringify(input.definition);
      const wf = workflows.create({ ...input, definition: def });
      return { ok: true, data: wf };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
  handle("workflows:update", (id, input) => {
    try {
      const dbInput: Record<string, unknown> = { ...input };
      if (input.definition) dbInput.definition = JSON.stringify(input.definition);
      const wf = workflows.update(id, dbInput as Parameters<typeof workflows.update>[1]);
      if (!wf) return { ok: false, error: "Workflow not found" };
      return { ok: true, data: wf };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
  handle("workflows:delete", (id) => {
    if (!workflows.delete(id)) return { ok: false, error: "Workflow not found" };
    return { ok: true, data: true };
  });
  handle("workflows:execute", (workflowId, goalId?) => {
    try {
      const wf = workflows.getById(workflowId);
      if (!wf) return { ok: false, error: "Workflow not found" };

      const def: WorkflowDefinition = JSON.parse(wf.definition);
      if (def.nodes.length === 0) return { ok: false, error: "Workflow has no nodes" };

      // Build adjacency: nodeId -> taskIds that depend on it
      const inDegree = new Map<string, number>();
      const adjacency = new Map<string, string[]>();
      for (const node of def.nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
      }
      for (const edge of def.edges) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
        adjacency.get(edge.source)!.push(edge.target);
      }

      // Topological sort to determine task creation order
      const queue: string[] = [];
      for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
      }

      const nodeTaskMap = new Map<string, string>();
      const createdTaskIds: string[] = [];
      const goal = goalId ?? null;

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = def.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        // Find upstream task IDs from edges targeting this node
        const upstreamEdges = def.edges.filter((e) => e.target === nodeId);
        const dependsOn = upstreamEdges
          .map((e) => nodeTaskMap.get(e.source))
          .filter((id): id is string => !!id);

        const task = tasks.create({
          goal_id: goal ?? "00000000-0000-0000-0000-000000000000",
          agent_id: node.data.agentId ?? undefined,
          title: node.data.label,
          description: node.data.description ?? `Workflow step: ${node.data.label}`,
          depends_on: dependsOn,
          priority: 0,
        });

        nodeTaskMap.set(nodeId, task.id);
        createdTaskIds.push(task.id);

        // Decrement in-degree for downstream nodes
        for (const target of adjacency.get(nodeId) ?? []) {
          const newDeg = (inDegree.get(target) ?? 1) - 1;
          inDegree.set(target, newDeg);
          if (newDeg === 0) queue.push(target);
        }
      }

      return {
        ok: true,
        data: { workflowId, taskIds: createdTaskIds, goalId: goal },
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // ── Workflow Templates ──
  handle("workflow-templates:list", () => {
    const builtIn = workflows.listBuiltIn();
    const userTemplates = workflows.listUserTemplates();
    return { builtIn, userTemplates };
  });

  handle("workflow-templates:get", (id) => {
    const template = workflows.getById(id);
    return template?.is_template ? template : undefined;
  });

  handle("workflow-templates:instantiate", (templateId, overrides?) => {
    try {
      const workflow = workflows.instantiate(templateId, overrides);
      if (!workflow) return { ok: false, error: "Template not found" };
      return { ok: true, data: workflow };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  handle("workflow-templates:save", (workflowId, overrides?) => {
    try {
      const template = workflows.saveAsTemplate(workflowId, overrides);
      if (!template) return { ok: false, error: "Source workflow not found" };
      return { ok: true, data: template };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Initialize cron scheduler
  cronScheduler = new CronScheduler(cronSchedules, tasks, orchestrator);
  cronScheduler.on("trigger", (event) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send(IPC_CHANNELS.CRON_SCHEDULES_TRIGGERED, event);
    }
  });

  return { agents };
}

app.whenReady().then(async () => {
  applySecurityPolicies();
  applyCsp();
  const { agents } = registerIPC();
  startAnalytics();
  cronScheduler.start();
  const win = createWindow();
  Menu.setApplicationMenu(buildMenu(win));

  // Auto health check for all configured agents on launch (non-blocking)
  const allAgents = agents.list();
  const checks = allAgents
    .filter((a) => a.executable_path)
    .map((a) =>
      agentRuntime.healthCheck(a.id, a.executable_path!).then((result) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.webContents.send(IPC_CHANNELS.AGENT_STATUS_CHANGED, result);
        }
        return result;
      }),
    );
  Promise.allSettled(checks);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  cronScheduler?.stop();
  orchestrator?.shutdown();
  agentRuntime.terminateAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
