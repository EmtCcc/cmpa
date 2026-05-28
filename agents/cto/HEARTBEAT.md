# HEARTBEAT.md -- CTO Heartbeat Checklist

Run this checklist on every heartbeat.

## 0. CRITICAL: Working Directory

**ALL code must be written to the project's actual workspace directory:**

```
/Users/cc_1/Documents/AgentOpsDesktop
```

**DO NOT** write code to Paperclip's internal directory (`/Users/cc_1/.paperclip/instances/default/companies/8`).

When creating or modifying files:
1. Always use the project workspace path above
2. Verify the file exists in the correct location after writing
3. If you need to find the project path, use: `GET /api/companies/{companyId}/projects` and check `codebase.effectiveLocalFolder`

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If there is already an active run on an `in_progress` task, move on to the next thing.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 3. Phase Gate Check (multi-phase analysis issues)

Before working on any issue whose title starts with "Phase 2" or "Phase 3", you MUST verify prerequisites:

### For Phase 2 issues:
1. Find the Phase 1 analysis issue (search: `GET /api/companies/{companyId}/issues?search=竞品深度扫描`)
2. Get its child issues: `GET /api/companies/{companyId}/issues?parentId={phase1-id}`
3. Check if ALL P0 children are `done`:
   - Filter children whose title starts with "P0-"
   - If any P0 child is NOT `done`, comment on the Phase 2 issue:
     ```
     ⏳ 等待 Phase 1 P0 完成。当前状态：
     - P0-1: {status}
     - P0-2: {status}
     - P0-3: {status}
     - P0-4: {status}
     Phase 2 将在所有 P0 issue 完成后自动启动。
     ```
   - Then exit without starting work.

### For Phase 3 issues:
1. Find the Phase 2 issue: `GET /api/companies/{companyId}/issues?search=Phase 2`
2. If Phase 2 status is NOT `done`, comment and exit (same pattern as above).

### If prerequisites are met:
- Proceed to checkout and work normally.

## 4. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.

## 5. Technical Oversight

- When reviewing architecture or code: focus on correctness, simplicity, and operational impact.
- When unblocking engineers: provide concrete solutions, not abstract guidance.
- When making architecture decisions: document the decision and reasoning in the issue or project docs.

## 6. Deliverable Decomposition (analysis / planning / research tasks)

When you complete an issue that produces planning artifacts (roadmaps, gap analyses, architecture designs, competitive scans, etc.), you MUST do the following **before** marking the issue done:

1. **Post a structured deliverable comment** on the issue with this format:

```markdown
## Deliverables

| File | Description |
|------|-------------|
| `docs/xxx.md` | Brief description |
| `docs/xxx.csv` | Brief description |

## Suggested Follow-up Issues

| # | Title | Priority | Suggested Assignee | Depends On |
|---|-------|----------|--------------------|------------|
| 1 | P0-1: Multi-agent parallel engine | critical | Software Engineer | — |
| 2 | P0-2: Agent communication / handoff | high | Software Engineer | #1 |
| 3 | P0-3: Visual dashboard | high | UI & Brand Designer, Software Engineer | #1 |
```

2. **Create the follow-up issues** via `POST /api/companies/{companyId}/issues`:
   - Set `parentId` to the current analysis issue
   - Set `goalId` to the same goal as the analysis issue
   - Set `projectId` to `ceb86779-d87d-498e-ab3e-bd6c273da277` (花影风幻 project)
   - Set `priority` based on the roadmap (P0=critical, P1=high, P2=medium)
   - Set `description` to include: context from the roadmap, acceptance criteria, and link to the source deliverable
   - Leave `assigneeAgentId` **unset** -- the Product Owner will handle assignment
   - Add relevant `labelIds` (fetch via `GET /api/companies/{companyId}/labels`)

3. **Comment on the issue** tagging the Product Owner: `@Product Owner — roadmap decomposed into N follow-up issues. Ready for prioritization and assignment.`

Rules:
- Do NOT skip decomposition for analysis/planning tasks. A roadmap that stays as a document is dead weight.
- Each follow-up issue must be small enough for a single agent session.
- Set `blockParentUntilDone: true` on child issues if the parent should stay blocked until all children complete.
- If the roadmap has dependencies between items, document them in the issue descriptions.

## 7. Handover

- When your work requires action from another agent, @-mention them on the issue with a clear summary of what's needed.
- Update issue status appropriately (e.g., `in_review` if awaiting review).

## 8. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- **ALWAYS write code to `/Users/cc_1/Documents/AgentOpsDesktop`** -- never to Paperclip's internal directory.

<!-- Module heartbeat sections are inserted above this line during assembly -->
