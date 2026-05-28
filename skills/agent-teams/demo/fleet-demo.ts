import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Agent Teams Demo — 960 Hull Class Architecture
 *
 * 9 independent hulls (agents), each a sovereign process with its own PID:
 *
 *   PID 1 — CAD     (Air Traffic Controller / Mission Commander)
 *   PID 2 — BP      (Business Planner)
 *   PID 3 — Design  (UI/UX Designer)
 *   PID 4 — Dev     (Software Engineer)
 *   PID 5 — QA      (Quality Assurance)
 *   PID 6 — Ops     (Release Engineer)
 *   PID 7 — Security (Security Reviewer)
 *   PID 8 — Analytics (Data Analyst)
 *   PID 9 — Support (Customer Support)
 *
 * Authority Model (from God Object Deconstruction):
 *
 *   CAD (PID 1) — Air Traffic Control
 *     - OWNS: mission sequencing, hull scheduling, conflict resolution
 *     - CANNOT: directly modify code, run tests, deploy, or change designs
 *     - AUTHORITY: can pause/resume/abort any hull, approve/reject handoffs
 *
 *   Hulls (PID 2-9) — Domain Sovereigns
 *     - OWNS: their domain artifacts (BP owns PRD, Dev owns source, etc.)
 *     - CANNOT: modify other hulls' artifacts, spawn new hulls, change mission plan
 *     - AUTHORITY: full control within their domain boundary
 *
 * Communication: All through Air Traffic Controller (PID 0 → Agent Bus MCP Server).
 * Hulls do NOT talk to each other directly — all coordination goes through CAD.
 *
 * The CAD is NOT a god object — it's a peer hull with coordination authority only.
 * It participates in the mission like any other hull, but with a coordination role.
 */

// ═══════════════════════════════════════════════════════════════
// Hull Identity — Each hull has a unique PID and domain boundary
// ═══════════════════════════════════════════════════════════════

interface HullIdentity {
  pid: number;
  name: string;
  domain: string;        // What this hull OWNS
  canDo: string[];       // Actions within its authority
  cannotDo: string[];    // Actions outside its authority
  busAddress: string;    // How to reach this hull on the Agent Bus
}

const FLEET: Record<string, HullIdentity> = {
  cad: {
    pid: 1,
    name: "CAD",
    domain: "mission-sequencing",
    canDo: [
      "schedule-hulls",
      "approve-handoffs",
      "resolve-conflicts",
      "pause/resume/abort-hulls",
      "track-mission-progress",
    ],
    cannotDo: [
      "modify-code",
      "run-tests",
      "deploy",
      "change-designs",
      "write-prd",
    ],
    busAddress: "fleet://hulls/1/cad",
  },
  bp: {
    pid: 2,
    name: "Business Planner",
    domain: "requirements",
    canDo: ["write-prd", "define-stories", "set-priorities", "accept-completion"],
    cannotDo: ["modify-code", "run-tests", "deploy", "schedule-hulls"],
    busAddress: "fleet://hulls/2/bp",
  },
  design: {
    pid: 3,
    name: "UI/UX Designer",
    domain: "design",
    canDo: ["create-wireframes", "define-ui-spec", "review-visual", "build-prototype"],
    cannotDo: ["modify-code", "run-tests", "deploy", "change-requirements"],
    busAddress: "fleet://hulls/3/design",
  },
  dev: {
    pid: 4,
    name: "Software Engineer",
    domain: "source-code",
    canDo: ["write-code", "refactor", "fix-bugs", "create-pr"],
    cannotDo: ["deploy", "merge-to-main", "change-requirements", "approve-own-pr"],
    busAddress: "fleet://hulls/4/dev",
  },
  qa: {
    pid: 5,
    name: "Quality Assurance",
    domain: "test-artifacts",
    canDo: ["run-tests", "write-tests", "regression-test", "approve-pr"],
    cannotDo: ["modify-code", "deploy", "merge-pr", "change-requirements"],
    busAddress: "fleet://hulls/5/qa",
  },
  ops: {
    pid: 6,
    name: "Release Engineer",
    domain: "deployment",
    canDo: ["deploy", "rollback", "configure-env", "monitor"],
    cannotDo: ["modify-code", "change-requirements", "approve-pr", "run-tests"],
    busAddress: "fleet://hulls/6/ops",
  },
  security: {
    pid: 7,
    name: "Security Reviewer",
    domain: "security-artifacts",
    canDo: ["threat-model", "security-review", "audit-deps", "approve-security"],
    cannotDo: ["modify-code", "deploy", "change-requirements"],
    busAddress: "fleet://hulls/7/security",
  },
  analytics: {
    pid: 8,
    name: "Data Analyst",
    domain: "metrics",
    canDo: ["collect-metrics", "analyze-data", "generate-reports", "track-kpis"],
    cannotDo: ["modify-code", "deploy", "change-requirements", "approve-pr"],
    busAddress: "fleet://hulls/8/analytics",
  },
  support: {
    pid: 9,
    name: "Customer Support",
    domain: "user-feedback",
    canDo: ["collect-feedback", "triage-issues", "escalate-bugs", "update-changelog"],
    cannotDo: ["modify-code", "deploy", "change-requirements", "approve-pr"],
    busAddress: "fleet://hulls/9/support",
  },
};

// ═══════════════════════════════════════════════════════════════
// Shared Graph — The flat knowledge graph all hulls read/write
// ═══════════════════════════════════════════════════════════════

interface GraphNode {
  id: string;
  type: string;           // mission | story | task | artifact | decision | risk | metric
  content: string;
  owner: string;          // Which hull owns this node
  status: string;         // proposed | active | done | blocked | archived
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;           // depends-on | blocks | implements | tests | validates | ships-with
  createdAt: number;
}

const graph = {
  nodes: new Map<string, GraphNode>(),
  edges: new Map<string, GraphEdge>(),
};

// ═══════════════════════════════════════════════════════════════
// Mission State — Shared mission lifecycle
// ═══════════════════════════════════════════════════════════════

interface MissionState {
  id: string;
  name: string;
  phase: "planning" | "design" | "implementation" | "validation" | "deployment" | "complete";
  activeHulls: Set<string>;   // Which hulls are currently engaged
  handoffQueue: Array<{
    id: string;
    from: string;
    to: string;
    artifact: string;
    status: "pending" | "approved" | "rejected" | "delivered";
    reason?: string;
  }>;
  conflicts: Array<{
    id: string;
    hullA: string;
    hullB: string;
    description: string;
    resolution?: string;
    resolvedBy?: string;
  }>;
}

const mission: MissionState = {
  id: "mission-001",
  name: "Build Task Manager App",
  phase: "planning",
  activeHulls: new Set(["cad", "bp"]),
  handoffQueue: [],
  conflicts: [],
};

// ═══════════════════════════════════════════════════════════════
// Authority Enforcement — No hull can act outside its boundary
// ═══════════════════════════════════════════════════════════════

class AuthorityError extends Error {
  constructor(
    public hullId: string,
    public attemptedAction: string,
    public allowedActions: string[],
  ) {
    super(
      `[AUTHORITY VIOLATION] Hull "${hullId}" attempted "${attemptedAction}" ` +
      `but is only authorized for: ${allowedActions.join(", ")}`,
    );
    this.name = "AuthorityError";
  }
}

/**
 * Enforce authority boundary before any hull action.
 * Throws AuthorityError if the hull is acting outside its domain.
 */
function enforceAuthority(hullId: string, action: string): void {
  const hull = FLEET[hullId];
  if (!hull) {
    throw new Error(`Unknown hull: ${hullId}`);
  }

  // CAD has special coordination authority — it can schedule any hull
  if (hullId === "cad" && action.startsWith("schedule-")) {
    return; // CAD can schedule any hull
  }

  // CAD can approve/reject handoffs
  if (hullId === "cad" && (action.startsWith("approve-") || action.startsWith("reject-"))) {
    return;
  }

  // CAD can pause/resume/abort
  if (hullId === "cad" && (action.startsWith("pause-") || action.startsWith("resume-") || action.startsWith("abort-"))) {
    return;
  }

  if (!hull.canDo.includes(action)) {
    throw new AuthorityError(hullId, action, hull.canDo);
  }
}

/**
 * Verify hull can access a graph node (must be owner or CAD reviewing).
 */
function enforceNodeAccess(hullId: string, nodeId: string, write: boolean = false): void {
  const node = graph.nodes.get(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // CAD can read any node for coordination, but cannot write to domain nodes
  if (hullId === "cad") {
    if (write && node.type !== "mission" && node.type !== "decision") {
      throw new AuthorityError(
        hullId,
        `write-node:${nodeId}`,
        ["write-mission-nodes", "write-decision-nodes"],
      );
    }
    return;
  }

  // Hulls can only write to nodes they own
  if (write && node.owner !== hullId) {
    throw new AuthorityError(
      hullId,
      `write-node:${nodeId}`,
      [`write-own-${hull.domain}-nodes`],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Hull Operations — Each hull's domain actions
// ═══════════════════════════════════════════════════════════════

/**
 * BP (PID 2) — Writes requirements to the shared graph.
 */
function bpWriteRequirements(hullId: string, requirements: string): GraphNode {
  enforceAuthority(hullId, "write-prd");

  const node: GraphNode = {
    id: `req-${Date.now()}`,
    type: "artifact",
    content: requirements,
    owner: "bp",
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: { artifactType: "prd" },
  };

  graph.nodes.set(node.id, node);
  return node;
}

/**
 * Dev (PID 4) — Writes code artifacts to the shared graph.
 */
function devWriteCode(hullId: string, code: string, filePath: string): GraphNode {
  enforceAuthority(hullId, "write-code");

  const node: GraphNode = {
    id: `code-${Date.now()}`,
    type: "artifact",
    content: code,
    owner: "dev",
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: { artifactType: "code", filePath },
  };

  graph.nodes.set(node.id, node);
  return node;
}

/**
 * QA (PID 5) — Runs tests and writes results to the shared graph.
 */
function qaRunTests(hullId: string, targetNodeId: string, testResults: string): GraphNode {
  enforceAuthority(hullId, "run-tests");
  enforceNodeAccess(hullId, targetNodeId, false); // QA can READ code nodes

  const node: GraphNode = {
    id: `test-${Date.now()}`,
    type: "artifact",
    content: testResults,
    owner: "qa",
    status: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: { artifactType: "test-results", targetNode: targetNodeId },
  };

  graph.nodes.set(node.id, node);

  // Create edge: test validates code
  const edge: GraphEdge = {
    id: `edge-${Date.now()}`,
    source: node.id,
    target: targetNodeId,
    type: "validates",
    createdAt: Date.now(),
  };
  graph.edges.set(edge.id, edge);

  return node;
}

/**
 * QA (PID 5) — Approves a PR (QA has approval authority).
 */
function qaApprovePr(hullId: string, prId: string): { approved: boolean; reason: string } {
  enforceAuthority(hullId, "approve-pr");

  // In real system, would check PR status, test results, etc.
  return { approved: true, reason: "All tests passed, code quality meets standards" };
}

/**
 * Dev (PID 4) — CANNOT approve own PR (authority boundary).
 */
function devApproveOwnPr(hullId: string): never {
  enforceAuthority(hullId, "approve-own-pr"); // Will throw AuthorityError
  throw new Error("Unreachable");
}

/**
 * CAD (PID 1) — Schedules a hull for a mission phase.
 * CAD can do this because scheduling is within its coordination authority.
 */
function cadScheduleHull(hullId: string, targetHull: string, task: string): string {
  enforceAuthority(hullId, `schedule-${targetHull}`);

  if (!FLEET[targetHull]) {
    throw new Error(`Unknown hull: ${targetHull}`);
  }

  mission.activeHulls.add(targetHull);

  return `[CAD] Scheduled hull "${targetHull}" (PID ${FLEET[targetHull].pid}) for task: ${task}`;
}

/**
 * CAD (PID 1) — CANNOT write code (authority boundary).
 */
function cadWriteCode(hullId: string): never {
  enforceAuthority(hullId, "write-code"); // Will throw AuthorityError
  throw new Error("Unreachable");
}

/**
 * CAD (PID 1) — Approves a handoff between hulls.
 */
function cadApproveHandoff(
  hullId: string,
  handoffId: string,
): { approved: boolean; reason: string } {
  enforceAuthority(hullId, "approve-handoffs");

  const handoff = mission.handoffQueue.find((h) => h.id === handoffId);
  if (!handoff) {
    throw new Error(`Handoff not found: ${handoffId}`);
  }

  handoff.status = "approved";
  return { approved: true, reason: `Handoff from ${handoff.from} to ${handoff.to} approved` };
}

/**
 * CAD (PID 1) — Resolves a conflict between hulls.
 */
function cadResolveConflict(
  hullId: string,
  conflictId: string,
  resolution: string,
): { resolved: boolean; resolution: string } {
  enforceAuthority(hullId, "resolve-conflicts");

  const conflict = mission.conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict not found: ${conflictId}`);
  }

  conflict.resolution = resolution;
  conflict.resolvedBy = "cad";
  return { resolved: true, resolution };
}

/**
 * Any hull — Creates a handoff request (goes through CAD for approval).
 */
function requestHandoff(
  fromHull: string,
  toHull: string,
  artifactId: string,
): string {
  const from = FLEET[fromHull];
  const to = FLEET[toHull];
  if (!from || !to) {
    throw new Error(`Unknown hull: ${fromHull} or ${toHull}`);
  }

  const handoff = {
    id: `handoff-${Date.now()}`,
    from: fromHull,
    to: toHull,
    artifact: artifactId,
    status: "pending" as const,
  };

  mission.handoffQueue.push(handoff);
  return handoff.id;
}

/**
 * Any hull — Reports a conflict (CAD will resolve).
 */
function reportConflict(
  hullA: string,
  hullB: string,
  description: string,
): string {
  const conflict = {
    id: `conflict-${Date.now()}`,
    hullA,
    hullB,
    description,
  };

  mission.conflicts.push(conflict);
  return conflict.id;
}

// ═══════════════════════════════════════════════════════════════
// Bus Messaging — Hull-to-hull communication through CAD
// ═══════════════════════════════════════════════════════════════

interface BusMessage {
  id: string;
  from: string;     // sender hull ID
  to: string;       // receiver hull ID (or "broadcast")
  type: string;     // request | response | notification | handoff-request
  payload: unknown;
  timestamp: number;
  requiresApproval: boolean; // If true, CAD must approve before delivery
}

const messageQueue: BusMessage[] = [];

/**
 * Send a message through the Agent Bus.
 * All messages route through CAD (PID 0 / Air Traffic Controller).
 */
function sendMessage(
  from: string,
  to: string,
  type: string,
  payload: unknown,
  requiresApproval: boolean = false,
): string {
  // Validate sender exists
  if (!FLEET[from]) {
    throw new Error(`Unknown sender hull: ${from}`);
  }

  // Validate receiver exists (or is "broadcast")
  if (to !== "broadcast" && !FLEET[to]) {
    throw new Error(`Unknown receiver hull: ${to}`);
  }

  const message: BusMessage = {
    id: `msg-${Date.now()}`,
    from,
    to,
    type,
    payload,
    timestamp: Date.now(),
    requiresApproval,
  };

  messageQueue.push(message);
  return message.id;
}

/**
 * CAD approves delivery of a message that requires approval.
 */
function cadApproveMessage(hullId: string, messageId: string): boolean {
  enforceAuthority(hullId, "approve-handoffs"); // Uses same approval authority

  const message = messageQueue.find((m) => m.id === messageId);
  if (!message) {
    throw new Error(`Message not found: ${messageId}`);
  }

  // Mark as approved (in real system, would deliver to recipient)
  message.requiresApproval = false;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// MCP Server — Expose fleet operations as tools
// ═══════════════════════════════════════════════════════════════

const server = new McpServer({
  name: "agent-teams-fleet-demo",
  version: "1.0.0",
});

// --- Fleet Identity ---

server.tool(
  "fleet:identify",
  "Get fleet hull identities and authority boundaries",
  {
    hullId: z.string().optional().describe("Specific hull to query (omit for all)"),
  },
  async ({ hullId }) => {
    if (hullId) {
      const hull = FLEET[hullId];
      if (!hull) return { content: [{ type: "text", text: `Unknown hull: ${hullId}` }] };
      return {
        content: [{ type: "text", text: JSON.stringify(hull, null, 2) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(FLEET, null, 2) }],
    };
  },
);

// --- Mission Operations ---

server.tool(
  "mission:status",
  "Get current mission state (phase, active hulls, handoffs, conflicts)",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        ...mission,
        activeHulls: Array.from(mission.activeHulls),
      }, null, 2),
    }],
  }),
);

server.tool(
  "mission:advance",
  "CAD advances mission to next phase (CAD authority required)",
  {
    hullId: z.string().describe("Hull requesting the advance (must be cad)"),
    phase: z.enum(["planning", "design", "implementation", "validation", "deployment", "complete"]),
  },
  async ({ hullId, phase }) => {
    try {
      enforceAuthority(hullId, "schedule-hulls"); // CAD's coordination authority
      mission.phase = phase;
      return {
        content: [{
          type: "text",
          text: `[CAD] Mission advanced to phase: ${phase}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- Hull Scheduling ---

server.tool(
  "fleet:schedule",
  "CAD schedules a hull for a task (CAD authority required)",
  {
    hullId: z.string().describe("Hull requesting the schedule (must be cad)"),
    targetHull: z.string().describe("Hull to schedule"),
    task: z.string().describe("Task description"),
  },
  async ({ hullId, targetHull, task }) => {
    try {
      const result = cadScheduleHull(hullId, targetHull, task);
      return { content: [{ type: "text", text: result }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- BP Operations ---

server.tool(
  "bp:write-requirements",
  "Business Planner writes requirements to shared graph",
  {
    hullId: z.string().describe("Must be 'bp'"),
    requirements: z.string().describe("Requirements content"),
  },
  async ({ hullId, requirements }) => {
    try {
      const node = bpWriteRequirements(hullId, requirements);
      return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- Dev Operations ---

server.tool(
  "dev:write-code",
  "Software Engineer writes code to shared graph",
  {
    hullId: z.string().describe("Must be 'dev'"),
    code: z.string().describe("Code content"),
    filePath: z.string().describe("Target file path"),
  },
  async ({ hullId, code, filePath }) => {
    try {
      const node = devWriteCode(hullId, code, filePath);
      return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- QA Operations ---

server.tool(
  "qa:run-tests",
  "QA runs tests and writes results to shared graph",
  {
    hullId: z.string().describe("Must be 'qa'"),
    targetNodeId: z.string().describe("Node to test"),
    testResults: z.string().describe("Test results"),
  },
  async ({ hullId, targetNodeId, testResults }) => {
    try {
      const node = qaRunTests(hullId, targetNodeId, testResults);
      return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

server.tool(
  "qa:approve-pr",
  "QA approves a PR (QA authority required)",
  {
    hullId: z.string().describe("Must be 'qa'"),
    prId: z.string().describe("PR to approve"),
  },
  async ({ hullId, prId }) => {
    try {
      const result = qaApprovePr(hullId, prId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- Authority Violation Demo ---

server.tool(
  "demo:authority-violation",
  "Demonstrate authority boundary enforcement (shows what happens when a hull acts outside its domain)",
  {
    scenario: z.enum([
      "dev-approves-own-pr",    // Dev trying to approve own PR
      "cad-writes-code",        // CAD trying to write code
      "bp-runs-tests",          // BP trying to run tests
      "qa-deploys",             // QA trying to deploy
    ]),
  },
  async ({ scenario }) => {
    try {
      switch (scenario) {
        case "dev-approves-own-pr":
          devApproveOwnPr("dev");
          break;
        case "cad-writes-code":
          cadWriteCode("cad");
          break;
        case "bp-runs-tests":
          enforceAuthority("bp", "run-tests");
          break;
        case "qa-deploys":
          enforceAuthority("qa", "deploy");
          break;
      }
      return { content: [{ type: "text", text: "No violation (should not reach here)" }] };
    } catch (e) {
      if (e instanceof AuthorityError) {
        return {
          content: [{
            type: "text",
            text: `[AUTHORITY BOUNDARY ENFORCED]\n\n${e.message}\n\nThis is correct behavior — the hull is prevented from acting outside its domain.`,
          }],
        };
      }
      return { content: [{ type: "text", text: `Unexpected error: ${(e as Error).message}` }] };
    }
  },
);

// --- Bus Messaging ---

server.tool(
  "bus:send",
  "Send a message through the Agent Bus (routes through CAD)",
  {
    from: z.string().describe("Sender hull ID"),
    to: z.string().describe("Receiver hull ID (or 'broadcast')"),
    type: z.enum(["request", "response", "notification", "handoff-request"]),
    payload: z.string().describe("Message payload (JSON string)"),
    requiresApproval: z.boolean().optional().describe("If true, CAD must approve delivery"),
  },
  async ({ from, to, type, payload, requiresApproval }) => {
    try {
      const msgId = sendMessage(from, to, type, JSON.parse(payload), requiresApproval);
      return {
        content: [{
          type: "text",
          text: `Message sent: ${msgId}\nFrom: ${from} → To: ${to}\nType: ${type}\nRequires CAD Approval: ${requiresApproval ?? false}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

server.tool(
  "bus:approve",
  "CAD approves delivery of a pending message",
  {
    hullId: z.string().describe("Must be 'cad'"),
    messageId: z.string().describe("Message to approve"),
  },
  async ({ hullId, messageId }) => {
    try {
      const result = cadApproveMessage(hullId, messageId);
      return { content: [{ type: "text", text: `Message ${messageId} approved for delivery` }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

server.tool(
  "bus:queue",
  "View the current message queue",
  {},
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify(messageQueue, null, 2),
    }],
  }),
);

// --- Handoff Operations ---

server.tool(
  "handoff:request",
  "Request a handoff of an artifact between hulls (requires CAD approval)",
  {
    from: z.string().describe("Source hull"),
    to: z.string().describe("Target hull"),
    artifactId: z.string().describe("Artifact node ID to hand off"),
  },
  async ({ from, to, artifactId }) => {
    try {
      const handoffId = requestHandoff(from, to, artifactId);
      return {
        content: [{
          type: "text",
          text: `Handoff requested: ${handoffId}\nFrom: ${from} → To: ${to}\nArtifact: ${artifactId}\nStatus: pending (requires CAD approval)`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

server.tool(
  "handoff:approve",
  "CAD approves a handoff request",
  {
    hullId: z.string().describe("Must be 'cad'"),
    handoffId: z.string().describe("Handoff to approve"),
  },
  async ({ hullId, handoffId }) => {
    try {
      const result = cadApproveHandoff(hullId, handoffId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- Conflict Resolution ---

server.tool(
  "conflict:report",
  "Report a conflict between hulls (CAD will resolve)",
  {
    hullA: z.string().describe("First hull in conflict"),
    hullB: z.string().describe("Second hull in conflict"),
    description: z.string().describe("Conflict description"),
  },
  async ({ hullA, hullB, description }) => {
    try {
      const conflictId = reportConflict(hullA, hullB, description);
      return {
        content: [{
          type: "text",
          text: `Conflict reported: ${conflictId}\nBetween: ${hullA} and ${hullB}\nDescription: ${description}\nAwaiting CAD resolution`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

server.tool(
  "conflict:resolve",
  "CAD resolves a conflict",
  {
    hullId: z.string().describe("Must be 'cad'"),
    conflictId: z.string().describe("Conflict to resolve"),
    resolution: z.string().describe("Resolution description"),
  },
  async ({ hullId, conflictId, resolution }) => {
    try {
      const result = cadResolveConflict(hullId, conflictId, resolution);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }] };
    }
  },
);

// --- Graph Inspection ---

server.tool(
  "graph:nodes",
  "View all nodes in the shared graph",
  {
    type: z.string().optional().describe("Filter by node type"),
    owner: z.string().optional().describe("Filter by owner hull"),
  },
  async ({ type, owner }) => {
    let nodes = Array.from(graph.nodes.values());
    if (type) nodes = nodes.filter((n) => n.type === type);
    if (owner) nodes = nodes.filter((n) => n.owner === owner);
    return {
      content: [{ type: "text", text: JSON.stringify(nodes, null, 2) }],
    };
  },
);

server.tool(
  "graph:edges",
  "View all edges in the shared graph",
  {
    type: z.string().optional().describe("Filter by edge type"),
  },
  async ({ type }) => {
    let edges = Array.from(graph.edges.values());
    if (type) edges = edges.filter((e) => e.type === type);
    return {
      content: [{ type: "text", text: JSON.stringify(edges, null, 2) }],
    };
  },
);

// --- Architecture Overview ---

server.tool(
  "demo:architecture",
  "Show the 960 Hull Class architecture model",
  {},
  async () => ({
    content: [{
      type: "text",
      text: `
╔══════════════════════════════════════════════════════════════════════════╗
║                    960 HULL CLASS ARCHITECTURE                          ║
║                    Agent Teams Fleet Model v1.0                         ║
╚══════════════════════════════════════════════════════════════════════════╝

FLEET COMPOSITION (9 Independent Hulls)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PID 1 ─ CAD (Air Traffic Controller)
  │  Domain: mission-sequencing
  │  Authority: schedule hulls, approve handoffs, resolve conflicts
  │  CANNOT: write code, run tests, deploy, change designs
  │
  PID 2 ─ BP (Business Planner)
  │  Domain: requirements
  │  Authority: write PRD, define stories, set priorities
  │  CANNOT: modify code, run tests, deploy
  │
  PID 3 ─ Design (UI/UX Designer)
  │  Domain: design
  │  Authority: create wireframes, define UI spec, review visual
  │  CANNOT: modify code, run tests, deploy
  │
  PID 4 ─ Dev (Software Engineer)
  │  Domain: source-code
  │  Authority: write code, refactor, fix bugs, create PR
  │  CANNOT: deploy, merge to main, approve own PR
  │
  PID 5 ─ QA (Quality Assurance)
  │  Domain: test-artifacts
  │  Authority: run tests, write tests, approve PR
  │  CANNOT: modify code, deploy, merge PR
  │
  PID 6 ─ Ops (Release Engineer)
  │  Domain: deployment
  │  Authority: deploy, rollback, configure env, monitor
  │  CANNOT: modify code, change requirements, approve PR
  │
  PID 7 ─ Security (Security Reviewer)
  │  Domain: security-artifacts
  │  Authority: threat model, security review, audit deps
  │  CANNOT: modify code, deploy, change requirements
  │
  PID 8 ─ Analytics (Data Analyst)
  │  Domain: metrics
  │  Authority: collect metrics, analyze data, generate reports
  │  CANNOT: modify code, deploy, change requirements
  │
  PID 9 ─ Support (Customer Support)
     Domain: user-feedback
     Authority: collect feedback, triage issues, escalate bugs
     CANNOT: modify code, deploy, change requirements

AUTHORITY MODEL (God Object Deconstruction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CAD is NOT a god object — it's a peer hull with coordination role.

  CAD OWNS:                    CAD CANNOT:
  ┌─────────────────────┐      ┌─────────────────────┐
  │ • Mission sequencing │      │ • Modify source code  │
  │ • Hull scheduling    │      │ • Run tests           │
  │ • Handoff approval   │      │ • Deploy              │
  │ • Conflict resolution│      │ • Change designs      │
  │ • Pause/resume/abort │      │ • Write requirements  │
  └─────────────────────┘      └─────────────────────┘

  Each hull is a DOMAIN SOVEREIGN:
  ┌─────────────────────────────────────────────────────┐
  │ Hull OWNS its artifacts completely                   │
  │ Hull CANNOT modify other hulls' artifacts            │
  │ Hull CANNOT spawn new hulls or change mission plan   │
  │ All cross-hull coordination goes through CAD         │
  └─────────────────────────────────────────────────────┘

COMMUNICATION MODEL
━━━━━━━━━━━━━━━━━━

  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │  Hull A  │───▶│   CAD   │◀───│  Hull B  │
  │  (PID X) │    │  (PID 1) │    │  (PID Y) │
  └─────────┘    └────┬────┘    └─────────┘
                      │
                      ▼
              ┌──────────────┐
              │  Agent Bus   │
              │  (PID 0)     │
              │  MCP Server  │
              └──────────────┘

  • All messages route through CAD (Air Traffic Controller)
  • Hulls do NOT talk directly to each other
  • CAD approves handoffs and resolves conflicts
  • Bus enforces message delivery ordering

SHARED GRAPH
━━━━━━━━━━━━

  All hulls read/write to a flat shared graph:

  ┌─────────────────────────────────────────────────────┐
  │  Graph Nodes:                                       │
  │    • mission    — Mission-level state               │
  │    • story      — User stories / requirements       │
  │    • task       — Implementation tasks              │
  │    • artifact   — Code, tests, designs, docs        │
  │    • decision   — Architecture/design decisions     │
  │    • risk       — Identified risks                  │
  │    • metric     — Performance/business metrics      │
  │                                                     │
  │  Graph Edges:                                       │
  │    • depends-on — Prerequisite relationship         │
  │    • blocks     — Blocking relationship             │
  │    • implements — Story → code mapping              │
  │    • tests      — Test → code mapping               │
  │    • validates  — QA approval relationship          │
  │    • ships-with — Release bundling                  │
  └─────────────────────────────────────────────────────┘

HULL INTERACTION FLOW
━━━━━━━━━━━━━━━━━━━━━

  1. CAD schedules hulls for mission phases
  2. Hulls work independently within their domain
  3. Hulls request handoffs when they need another hull's work
  4. CAD approves/rejects handoffs
  5. Hulls report conflicts to CAD
  6. CAD resolves conflicts and updates mission state
  7. Mission advances through phases: planning → design → implementation → validation → deployment → complete

AUTHORITY ENFORCEMENT
━━━━━━━━━━━━━━━━━━━━

  Every hull action is checked against its authority boundary:

  • enforceAuthority(hullId, action) — Throws if action outside domain
  • enforceNodeAccess(hullId, nodeId, write) — Throws if accessing unauthorized node
  • AuthorityError — Specific error type for boundary violations

  Examples of enforced boundaries:
  • Dev cannot approve own PR (requires QA approval)
  • CAD cannot write code (only coordinate)
  • BP cannot run tests (only define requirements)
  • QA cannot deploy (only validate)
`,
    }],
  }),
);

// ═══════════════════════════════════════════════════════════════
// Export for testing
// ═══════════════════════════════════════════════════════════════

export {
  server,
  FLEET,
  graph,
  mission,
  messageQueue,
  enforceAuthority,
  enforceNodeAccess,
  AuthorityError,
  bpWriteRequirements,
  devWriteCode,
  qaRunTests,
  qaApprovePr,
  devApproveOwnPr,
  cadScheduleHull,
  cadWriteCode,
  cadApproveHandoff,
  cadResolveConflict,
  requestHandoff,
  reportConflict,
  sendMessage,
  cadApproveMessage,
};
