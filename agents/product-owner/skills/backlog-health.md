# Skill: Backlog Health

You own the product backlog pipeline.

## Label Setup

Before creating your first batch of issues, set up labels for the company:

1. Check existing labels: `GET /api/companies/{companyId}/labels`
2. If no labels exist, create them via `POST /api/companies/{companyId}/labels` with `{ "name": "...", "color": "..." }`:

| Label | Color | Use for |
|:------|:------|:--------|
| feature | `0075ca` | New user-facing capability |
| bug | `d73a4a` | Defects and regressions |
| chore | `7057ff` | Refactoring, cleanup, dependency updates |
| spike | `006b75` | Research or investigation with a time-box |
| blocked | `e4e669` | Cannot proceed, needs unblocking |

Add additional labels if the roadmap calls for them (e.g., `docs`, `design`, `security`). Pick distinct hex colors.

## Deliverable Inspection

Run this on every heartbeat, BEFORE the backlog health check.

When an analysis, planning, or research issue is completed (status=done), the executor should have posted a `## Suggested Follow-up Issues` table in the comments. Your job is to validate and activate those suggestions.

1. Query recently completed issues: `GET /api/companies/{companyId}/issues?status=done&limit=10`
2. For each completed issue, fetch its comments: `GET /api/issues/{id}/comments`
3. Look for a comment containing `## Suggested Follow-up Issues` with a markdown table.
4. If found, check whether the suggested issues already exist:
   - Search by title: `GET /api/companies/{companyId}/issues?search={suggested-title-keyword}`
   - If an issue already exists, skip it.
5. For each suggestion that does NOT already exist as an issue:
   - Create it via `POST /api/companies/{companyId}/issues` with:
     - `title` from the suggestion table
     - `description` including context from the parent's deliverable, acceptance criteria, and a link to the parent issue
     - `priority` mapped from the roadmap (P0 → critical, P1 → high, P2 → medium, P3 → low)
     - `parentId` set to the analysis issue
     - `goalId` set to the same goal as the parent issue
     - `labelIds` fetched from `GET /api/companies/{companyId}/labels`
   - Leave `assigneeAgentId` unset — assignment happens in the next step.
6. After creating issues, run the Assignment Check (below) to assign them to idle agents.
7. Comment on the parent issue: `@{executor-agent} — Follow-up issues created and queued. N issues now in backlog.`
8. Record what you generated in your daily notes.

### Rules for Deliverable Inspection

- Only inspect issues completed within the last 24 hours.
- If the parent issue has no `## Suggested Follow-up Issues` comment, skip it. The executor may not have been required to decompose (e.g., a simple bug fix).
- Do NOT create duplicate issues. Always search first.
- If the suggested table is malformed or unclear, comment on the parent issue asking the executor to reformat.
- If the parent issue already has child issues (parentId matches), skip — already decomposed.

## Backlog Health Check

Run this on every heartbeat, after handling your own assignments and the deliverable inspection.

1. Query unassigned issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
2. If fewer than 3 unassigned issues remain:
   - Review the company goal and current progress
   - Identify the next logical chunk of work from the roadmap
   - Create 3-5 new issues via `POST /api/companies/{companyId}/issues`
   - Each issue must have: `title`, `description`, `priority`, `goalId`, `labelIds`
   - Fetch label IDs once per session: `GET /api/companies/{companyId}/labels`
   - Write clear acceptance criteria in the description
   - Leave issues unassigned — assignment happens separately
3. Record what you generated in your daily notes.

## Assignment Check

Run this after both deliverable inspection and backlog health check.

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. Query unassigned todo issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
3. Match issues to agents based on:
   - Agent role and capabilities (engineer → code tasks, designer → UI tasks, etc.)
   - Issue priority (critical first)
   - Agent specialization (check agent's AGENTS.md for relevant skills)
4. For each match:
   - Assign: `PATCH /api/issues/{id}` with `assigneeAgentId`
   - Comment on the issue: `Assigned to {agent-name}. @{{agent-name}} — please pick this up.`
5. Record assignments in daily notes.

## Rules

- Don't create duplicate issues. Check existing issues before creating new ones.
- Keep issues small and actionable. Each should be completable in a single agent session.
- Set priority based on roadmap order and dependencies.
- Always attach at least one label to every issue you create.
- If the goal is fully decomposed into issues, don't create more. Report to the CEO instead.
- Coordinate with the CEO on strategic priorities when unclear.
