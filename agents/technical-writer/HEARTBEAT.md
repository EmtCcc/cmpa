# HEARTBEAT.md -- Technical Writer Heartbeat

## 0. CRITICAL: Working Directory

**ALL code must be written to the project actual workspace directory:**

```
/Users/cc_1/Documents/AgentOpsDesktop
```

**DO NOT** write code to Paperclip internal directory (`/Users/cc_1/.paperclip/instances/default/companies/8`).

When creating or modifying files:
1. Always use the project workspace path above
2. Verify the file exists in the correct location after writing
3. If you need to find the project path, use: `GET /api/companies/{companyId}/projects` and check `codebase.effectiveLocalFolder`
## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.

## 3. Document

- Checkout: `POST /api/issues/{id}/checkout`.
- Read relevant code and existing docs.
- Write or update documentation.
- Verify accuracy against current codebase.
- Comment results on the originating issue.
- Mark issue done.

## 4. Exit

- If no assignments, exit cleanly.

## Rules
- **ALWAYS write code to `/Users/cc_1/Documents/AgentOpsDesktop`** -- never to Paperclip's internal directory.
- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never modify application code. Your domain is documentation only.

<!-- Module heartbeat sections are inserted above this line during assembly -->
