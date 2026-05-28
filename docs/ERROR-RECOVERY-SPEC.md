# Error Messages & Recovery Flows Spec

Addresses: CMPAAA-52 (C1 + M4 from user testing)
Heuristics: H9 (Error recovery) + H5 (Error prevention)

---

## 1. Agent Status Model

Current states from `AGENT_STATUS` in `src/shared/constants.ts`:

| Status | Meaning | Assignable? |
|--------|---------|-------------|
| `idle` | Agent healthy, ready for work | Yes |
| `active` | Agent currently executing a task | No |
| `inactive` | Agent manually paused/disabled | No |
| `offline` | Executable not found or unreachable | No |
| `error` | Health check failed (crash, timeout, bad config) | No |

**Guardrail rule (M4):** Task assignment UI MUST only allow selecting agents with status `idle`. All other statuses are disabled in the agent picker with a reason tooltip.

---

## 2. Failure Modes & Error Messages

### 2.1 Agent Crash (process exit with non-zero code)

| Field | Value |
|-------|-------|
| **Trigger** | Agent process exits with `code !== 0` during task execution |
| **Detection** | `child.on('exit')` in `agent-runtime.ts` fires with non-zero code |
| **Agent status** | Transitions to `error` |
| **Task sub-state** | Stays at whatever it was (`executing` most likely) |
| **UI indicator** | Red dot on agent card + red badge on task card |
| **Error message** | `"Agent crashed (exit code {code}). Task was interrupted."` |
| **Announcer** | `"Agent {name} crashed. Task \"{taskTitle}\" was interrupted."` |

**Recovery flow:**
1. Task remains in `in_progress` with sub-state frozen at last known state
2. User sees red dot on agent card + inline error on task card
3. User clicks task → sees error banner with message + "Reassign" and "Retry" buttons
4. **Retry**: Re-spawns same agent, resumes task from last checkpoint (if supported)
5. **Reassign**: Opens agent picker (filtered to `idle` agents only), moves task to new agent
6. **Dismiss**: Marks task as `pending` for manual re-queuing later

### 2.2 Agent Timeout (health check or execution timeout)

| Field | Value |
|-------|-------|
| **Trigger** | Health check exceeds 5s (`HEALTH_CHECK_TIMEOUT_MS`), or task execution exceeds configured limit |
| **Detection** | `setTimeout` in `healthCheck()` kills process with SIGKILL |
| **Agent status** | Transitions to `error` |
| **UI indicator** | Orange dot on agent card |
| **Error message** | `"Agent did not respond in time. It may be overloaded or stuck."` |
| **Announcer** | `"Agent {name} timed out. Task \"{taskTitle}\" may need to be reassigned."` |

**Recovery flow:**
1. Same as crash, but with "Check Again" button instead of "Retry"
2. "Check Again" triggers a fresh health check on the agent
3. If health check passes → agent returns to `idle`, user can retry task
4. If health check fails again → show "Force Restart" option (terminates + re-spawns)

### 2.3 Invalid Configuration (bad executable path, bad config_json)

| Field | Value |
|-------|-------|
| **Trigger** | `AgentValidationError` thrown during agent creation/update, or `healthCheck` returns `status: "error"` with validation message |
| **Detection** | `validateExecutable()` or `validateConfigJson()` in `agent-validation.ts` |
| **Agent status** | Stays at current status (never transitions to `idle`) |
| **UI indicator** | Yellow warning icon on agent card (not red — this is a config issue, not a runtime failure) |
| **Error message** | `"Agent configuration invalid: {specific reason}"` |
| **Examples** | `"Executable 'foo' is not in the allowlist"`, `"config_json must be valid JSON"` |

**Recovery flow:**
1. Agent card shows yellow warning with inline message
2. User clicks agent → opens edit dialog with the invalid field highlighted
3. Correcting the field and saving triggers a health check
4. If health check passes → warning clears, agent becomes `idle`
5. No task assignment possible while in this state (guardrail blocks it)

### 2.4 Connection Lost (process exists but unresponsive)

| Field | Value |
|-------|-------|
| **Trigger** | Agent was `active` but health check returns `offline` (executable no longer accessible) |
| **Detection** | `healthCheck()` → `ENOENT` or access denied |
| **Agent status** | Transitions to `offline` |
| **UI indicator** | Gray dot on agent card |
| **Error message** | `"Agent connection lost. The executable may have been removed or permissions changed."` |
| **Announcer** | `"Agent {name} went offline."` |

**Recovery flow:**
1. Agent card shows gray dot with "Offline" label
2. Tasks assigned to this agent show a banner: `"Assigned agent is offline. Reassign to continue."`
3. "Reassign" opens agent picker filtered to `idle` agents
4. User can also click agent → "Check Connection" to re-run health check
5. If executable becomes available again → agent returns to `idle`

### 2.5 Spawn Rejected (allowlist violation, arg overflow)

| Field | Value |
|-------|-------|
| **Trigger** | `spawn()` rejects request due to executable not in allowlist or args too long |
| **Detection** | `validateExecutable()` or `validateArgs()` in `agent-runtime.ts` |
| **Agent status** | No change (spawn never attempted) |
| **UI indicator** | Inline error in spawn dialog |
| **Error message** | Matches the validation message exactly (e.g., `"Executable 'rm' is not in the allowlist"`) |

**Recovery flow:**
1. Error shown inline in the spawn configuration dialog
2. User corrects the executable or args
3. No agent status change needed — this is a pre-flight rejection

---

## 3. Task Assignment Guardrail (M4)

### 3.1 Agent Picker Behavior

When assigning a task to an agent (create or update task):

| Agent Status | Picker Behavior |
|-------------|-----------------|
| `idle` | Selectable (default) |
| `active` | Disabled, tooltip: `"Agent is currently executing a task"` |
| `inactive` | Disabled, tooltip: `"Agent is paused. Activate it first."` |
| `offline` | Disabled, tooltip: `"Agent is offline. Check connection or reassign."` |
| `error` | Disabled, tooltip: `"Agent has an error. Fix configuration or restart."` |

### 3.2 Validation at Assignment Time

```
// Pseudocode for task assignment validation
function validateAssignment(taskId: string, agentId: string): Result {
  const agent = agentRepo.getById(agentId);
  if (!agent) return error("Agent not found");
  if (agent.status !== "idle") {
    return error(
      `Cannot assign task: agent "${agent.name}" is ${agent.status}. ` +
      `Only idle agents can be assigned new tasks.`
    );
  }
  return ok();
}
```

This validation runs at:
- `POST /api/tasks` (create with agent_id)
- `PATCH /api/tasks/:id` (update agent_id)

### 3.3 Race Condition: Agent Goes Offline Between Assignment and Execution

Even with the guardrail, an agent can go `offline` or `error` between assignment and when the runtime picks up the task. Handle this:

1. **Before execution starts**: Runtime checks agent status. If not `idle`, task stays in `queued` sub-state with a banner: `"Waiting for agent {name} to become available..."`
2. **During execution**: If agent crashes/times out, follow §2.1/§2.2 recovery flows
3. **Timeout**: If task stays in `queued` for > 5 minutes with a non-`idle` agent, auto-show reassign prompt

---

## 4. UI Error State Spec

### 4.1 Error Indicators by Component

| Component | Error State | Visual | Action |
|-----------|------------|--------|--------|
| Agent card (sidebar) | Status `error` | Red dot + status label | Click → agent detail with error |
| Agent card (sidebar) | Status `offline` | Gray dot + "Offline" label | Click → agent detail with reconnect |
| Agent card (sidebar) | Config invalid | Yellow warning icon | Click → edit dialog |
| Task card (board) | Agent crashed | Red left border + inline message | Click → task detail with recovery |
| Task card (board) | Agent timeout | Orange left border + inline message | Click → task detail with recovery |
| Task card (board) | Agent offline | Gray left border + "Reassign" link | Click → opens agent picker |
| Agent picker dropdown | Non-idle agent | Grayed out row + tooltip | Hover → tooltip explains why |

### 4.2 Error Banner Pattern

All task-level error banners follow this structure:

```html
<div class="error-banner" role="alert" aria-live="assertive">
  <span class="error-icon" aria-hidden="true"><!-- icon --></span>
  <span class="error-message">{human-readable message}</span>
  <div class="error-actions">
    <button class="btn-primary">{primary action}</button>
    <button class="btn-secondary">{secondary action}</button>
  </div>
</div>
```

- `role="alert"` ensures screen readers announce immediately
- `aria-live="assertive"` for critical errors (crash, timeout)
- `aria-live="polite"` for non-critical (offline, config warning)

### 4.3 ARIA Live Region Updates

Add to existing live regions in `docs/DESIGN-SYSTEM.md`:

| Location | Element | `aria-live` | Purpose |
|----------|---------|-------------|---------|
| Task error banner | `.task-error-banner` | `assertive` | Agent crash/timeout during execution |
| Agent status change | `#agent-status-announcer` | `polite` | Agent goes offline/error |
| Assignment rejection | `#assignment-error` | `polite` | Guardrail blocks assignment |

---

## 5. Implementation Checklist

- [ ] Add `error_message` field to task state (nullable string in DB schema)
- [ ] Add assignment validation endpoint/guard in `src/api/routes/tasks.ts`
- [ ] Add error banner component to task detail view in renderer
- [ ] Add status-based disabling to agent picker in renderer
- [ ] Add tooltips for disabled agents in picker
- [ ] Update `agent-runtime.ts` to set `error_message` on task when agent crashes
- [ ] Add "Reassign" and "Retry" actions to task error state
- [ ] Add ARIA live regions for error announcements
- [ ] Add `queued` sub-state timeout with auto-reassign prompt
- [ ] Write tests for assignment guardrail validation
- [ ] Write tests for error state transitions

---

## 6. Error Message String Table

Canonical list for i18n readiness:

| Code | Message |
|------|---------|
| `AGENT_CRASH` | `"Agent crashed (exit code {code}). Task was interrupted."` |
| `AGENT_TIMEOUT` | `"Agent did not respond in time. It may be overloaded or stuck."` |
| `AGENT_CONFIG_INVALID` | `"Agent configuration invalid: {reason}"` |
| `AGENT_OFFLINE` | `"Agent connection lost. The executable may have been removed or permissions changed."` |
| `AGENT_SPAWN_REJECTED` | `"Cannot start agent: {reason}"` |
| `ASSIGNMENT_BLOCKED` | `"Cannot assign task: agent \"{name}\" is {status}. Only idle agents can be assigned new tasks."` |
| `TASK_QUEUED_STALE` | `"Task has been waiting for agent \"{name}\" for over 5 minutes. Consider reassigning."` |
| `HEALTH_CHECK_FAILED` | `"Health check failed: {reason}"` |
| `HEALTH_CHECK_TIMEOUT` | `"Health check timed out after 5 seconds."` |

---

## 7. Implementation Reference: Assignment Guardrail

Actual TypeScript for the assignment validation, ready to drop into `src/api/routes/tasks.ts`:

```typescript
// src/api/routes/tasks.ts — add inside PATCH handler before repo.update()

/**
 * M4 guardrail: block task assignment to non-idle agents.
 * Returns error message if agent is not idle, null if OK.
 */
function checkAgentAssignable(
  agentRepo: AgentRepository,
  agentId: string,
): string | null {
  const agent = agentRepo.getById(agentId);
  if (!agent) return `Agent not found: ${agentId}`;
  if (agent.status !== "idle") {
    return `Cannot assign task: agent "${agent.name}" is ${agent.status}. Only idle agents can be assigned new tasks.`;
  }
  return null;
}

// Usage in PATCH /api/tasks/:id:
// if (agent_id) {
//   const blockReason = checkAgentAssignable(agentRepo, agent_id);
//   if (blockReason) {
//     sendJson(res, 409, { error: blockReason, code: "ASSIGNMENT_BLOCKED" });
//     return true;
//   }
// }
```

Implementation-ready validation in `src/main/agent-validation.ts`:

```typescript
// Add to src/main/agent-validation.ts

/**
 * Validate that an agent can accept new task assignments.
 * Throws AgentValidationError if agent is not idle.
 */
export function validateAgentAssignable(
  agent: { name: string; status: string },
  field = "agent_id",
): void {
  if (agent.status !== "idle") {
    throw new AgentValidationError(
      field,
      `Cannot assign task: agent "${agent.name}" is ${agent.status}. Only idle agents can be assigned new tasks.`,
    );
  }
}
```
