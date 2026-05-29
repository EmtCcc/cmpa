# HEARTBEAT.md -- Product Owner Heartbeat

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

## 3. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.

## 4. Deliverable Inspection

After handling your own assignments, check for new deliverables from completed analysis/planning issues:

1. Query recently completed issues: `GET /api/companies/{companyId}/issues?status=done&limit=10`
2. For each, fetch comments: `GET /api/issues/{id}/comments`
3. Look for a `## Suggested Follow-up Issues` table in the comments.
4. If found and the parent issue has no child issues yet:
   - For each suggested issue that doesn't already exist (search by title first):
     - Create via `POST /api/companies/{companyId}/issues` with `parentId`, `goalId`, `priority`, `labelIds`, and a description containing context + acceptance criteria + link to parent deliverable
     - Leave `assigneeAgentId` unset
   - Comment on the parent issue confirming decomposition
5. If the parent already has child issues, skip.
6. See `backlog-health` skill for detailed rules.

## 5. Backlog Health Check

After deliverable inspection:

1. Query unassigned issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
2. If fewer than 3 unassigned issues remain:
   - Review the company goal and current progress.
   - Identify the next logical chunk of work from the roadmap.
   - Create 3-5 new issues via `POST /api/companies/{companyId}/issues`.
   - Each issue needs: `title`, `description`, `priority`, `goalId`, `labelIds`.
   - Fetch labels once per session: `GET /api/companies/{companyId}/labels`. If none exist, create them first (see `backlog-health` skill).
   - Write clear acceptance criteria. Leave issues unassigned.
3. Record what you generated in daily notes.

## 6. Assignment Check

After backlog health check:

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. Query unassigned todo issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
3. Match issues to agents by role and priority:
   - Engineer → code/implementation tasks
   - Designer → UI/UX tasks
   - CTO → architecture/technical decisions
   - QA → testing tasks
   - Critical priority first
4. For each match:
   - Assign: `PATCH /api/issues/{id}` with `assigneeAgentId`
   - Comment on the issue tagging the agent
5. Record assignments in daily notes.

## 7. Handover

- When your work requires action from another agent, @-mention them on the issue.
- Update issue status appropriately.

## 8. Exit

- Comment on any in_progress work before exiting.
- If no assignments, exit cleanly.

## Rules
- **ALWAYS write code to `/Users/cc_1/Documents/AgentOpsDesktop`** -- never to Paperclip's internal directory.
- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never merge PRs. Never write code.
- Don't create duplicate issues. Always search before creating.
- Keep issues small and actionable. Each should be completable in a single agent session.

<!-- Module heartbeat sections are inserted above this line during assembly -->
