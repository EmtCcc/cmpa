# Bootstrap: 花影风幻

This is your bootstrap task. Create all the Paperclip objects listed below **in order**.

Each section (Goals, Projects, Agents, Issues, Routines) contains objects to create via the Paperclip API.

**How to read the metadata:**

- Direct values like `level: company` or `priority: high` → use as-is in the API call
- References like `parentId: → "Ship MVP"` → find the object with that name and use its ID
- `assigneeAgentId: → "engineer"` → find the agent with that role and use its ID
- `assigneeUserId: → board user` → assign to the board user (the human who created this company)

**Creation order** (respects dependencies):

1. **Goals** — top-level first, then sub-goals. Sub-goals have `parentId: → "Parent Title"` — create the parent first, then use its ID
2. **Projects** — reference goals via `goalIds`. Create after all goals exist
3. **Labels** — create issue labels (`POST /api/companies/{companyId}/labels` with `{ name, color }`). Use them to categorize issues
4. **Agents** — hire via governance. Set `instructionsFilePath` from the metadata
5. **Issues** — reference project via `projectId`, assign to agent via `assigneeAgentId` or to the board user via `assigneeUserId`. Attach labels via `labelIds`
6. **Routines** — reference project and agent. Add a cron trigger with the `schedule` value

**After bootstrap**: keep labels current. When creating new issues in your heartbeat, always assign appropriate labels.

## Goals

### AgentOps Desktop：本地优先的多智能体工作中枢

- **level**: company
- **status**: active

打造一个跨平台桌面应用，把现有 CLI Agent、编码助手和自动化工作流统一编排成一个可管理、可追踪、可治理的 AI 团队。

它结合：

- **Multica** 的 Agent 生命周期管理：任务分配、进度追踪、技能复用、运行时管理；
- **Paperclip** 的目标治理能力：公司/项目目标、组织架构、预算、审批、审计日志；
- **golutra** 的桌面端多 Agent 编排体验：兼容现有 CLI、并行执行、可视化监控、后台终端、工作流模板。

成功状态是：用户不用迁移项目、不用重学命令，就能在一个桌面应用里连接 Claude Code、Codex、Gemini CLI、OpenCode、Cursor、任意 CLI Agent；创建目标、拆解任务、分配给不同 Agent 并行执行；实时查看日志、状态、成本、阻塞点和交付结果；必要时人工审批、暂停、接管或回滚。最终让“一人 + 多个 AI 工具”的混乱操作，升级成“一人指挥一个 AI 团队”的稳定工作流。

\## Success looks like

- 用户可在 Windows / macOS / Linux 桌面端运行。
- 可接入多个本地或远程 Agent Runtime。
- 支持任务看板、Agent 角色、团队/组织结构、工作流模板。
- 支持并行执行、后台终端、实时日志、结果回传。
- 支持预算/成本控制、审批门禁、完整审计记录。
- 支持长期任务、定时任务、上下文记忆和可复用技能。
- MVP 能完成一个真实软件开发闭环：需求 → 分解 → 多 Agent 执行 → 测试 → 汇总 → 人工确认交付。

参考源头：  
[Multica](https://github.com/multica-ai/multica) · [Paperclip](https://github.com/paperclipai/paperclip) · [golutra](https://github.com/golutra/golutra)

### Build a REST API

- **level**: company
- **status**: active
- **parentId**: → "AgentOps Desktop：本地优先的多智能体工作中枢"

Design and implement a REST API from schema to documentation. Cover data modeling, endpoint implementation, authentication, and auto-generated API docs.

### Schema design

- **level**: team
- **status**: active
- **parentId**: → "Build a REST API"

Define the data model and database schema for the API. Database schema is defined, migrations exist, and the schema can be applied to a fresh database.

### Core endpoints

- **level**: team
- **status**: active
- **parentId**: → "Build a REST API"

Implement the CRUD endpoints for primary resources. All core resource endpoints work with proper status codes, validation, and error handling.

### Authentication and authorization

- **level**: team
- **status**: active
- **parentId**: → "Build a REST API"

Add authentication to protect endpoints and authorization to control access. Unauthenticated requests are rejected. Users can only access resources they are authorized to see.

### API documentation

- **level**: team
- **status**: active
- **parentId**: → "Build a REST API"

Generate and publish API documentation so consumers can integrate. API docs are generated from source and accessible at a known URL.

### Set up CI/CD pipeline

- **level**: company
- **status**: active
- **parentId**: → "AgentOps Desktop：本地优先的多智能体工作中枢"

Establish a complete CI/CD pipeline: automated linting, testing, building, and deployment. Every push to main should be verified automatically, and deployments should be reproducible and low-risk.

### Automated linting

- **level**: team
- **status**: active
- **parentId**: → "Set up CI/CD pipeline"

Enforce code quality standards automatically on every push. Linter runs in CI and blocks merges on failure.

### Automated testing

- **level**: team
- **status**: active
- **parentId**: → "Set up CI/CD pipeline"

Run the test suite automatically and report results. Tests run in CI with pass/fail status reported on commits and PRs.

### Automated build

- **level**: team
- **status**: active
- **parentId**: → "Set up CI/CD pipeline"

Build artifacts are produced automatically and consistently. Build step runs in CI and produces deployable artifacts.

### Automated deployment

- **level**: team
- **status**: active
- **parentId**: → "Set up CI/CD pipeline"

Deploy to staging or production with minimal manual intervention. Pushes to main trigger automated deployment to at least one environment.

### Launch MVP

- **level**: company
- **status**: active
- **parentId**: → "AgentOps Desktop：本地优先的多智能体工作中枢"

Ship a minimal viable product. Define scope tightly, build the core feature, deploy it, and iterate based on feedback. The goal is a working product in users' hands, not a polished one.

### Define scope

- **level**: team
- **status**: active
- **parentId**: → "Launch MVP"

Agree on what the MVP includes and — critically — what it does not. A written scope document exists with explicit in/out-of-scope lists, approved by the team.

### Build core feature

- **level**: team
- **status**: active
- **parentId**: → "Launch MVP"

Implement the single most important feature that delivers value to users. Core feature works end-to-end in a local development environment.

### Deploy

- **level**: team
- **status**: active
- **parentId**: → "Launch MVP"

Get the MVP running in a production-like environment accessible to users. Application is deployed, accessible via URL, and basic health checks pass.

### Iterate

- **level**: team
- **status**: active
- **parentId**: → "Launch MVP"

Collect feedback and ship improvements. Fix critical bugs, improve UX, add missing essentials. At least one round of user feedback has been incorporated and deployed.

### Website Relaunch

- **level**: company
- **status**: active
- **parentId**: → "AgentOps Desktop：本地优先的多智能体工作中枢"

Relaunch an existing website with a new design. Audit the current site, ingest design assets from an external agency, implement the new design, migrate content, and go live.

### Discovery & audit

- **level**: team
- **status**: active
- **parentId**: → "Website Relaunch"

Audit the current website — document page structure, content inventory, navigation, tech stack, and SEO baseline. Identify what to keep, migrate, or drop. A site audit document exists with page inventory, content map, tech stack notes, and migration decisions.

### Design handoff

- **level**: team
- **status**: active
- **parentId**: → "Website Relaunch"

Receive and process design assets from the external agency. Extract color palette, typography, component patterns, layout structure, and responsive breakpoints. Design spec document exists with extracted tokens (colors, fonts, spacing), component inventory, and page layouts documented.

### Implementation

- **level**: team
- **status**: active
- **parentId**: → "Website Relaunch"

Build the new site from the design spec. Set up the project, implement components, integrate content, and ensure responsive behavior. All pages from the design are implemented, responsive, and content is integrated. Local dev environment shows the complete site.

### Content migration

- **level**: team
- **status**: active
- **parentId**: → "Website Relaunch"

Migrate content from the old site to the new structure. Set up redirects for changed URLs. Verify no content is lost. All content from the old site is present in the new site. Redirect map covers all changed URLs. No broken internal links.

### QA & launch

- **level**: team
- **status**: active
- **parentId**: → "Website Relaunch"

Cross-browser testing, accessibility audit, performance optimization, SEO verification, and go-live. Site passes accessibility audit, loads under 3s, all redirects work, DNS is configured, and site is live.

## Projects

### 花影风幻

- **workspace**: /Users/cc_1/.paperclip/instances/default/companies/8/projects
- **goalIds**: "AgentOps Desktop：本地优先的多智能体工作中枢", "Build a REST API", "Schema design", "Core endpoints", "Authentication and authorization", "API documentation", "Set up CI/CD pipeline", "Automated linting", "Automated testing", "Automated build", "Automated deployment", "Launch MVP", "Define scope", "Build core feature", "Deploy", "Iterate", "Website Relaunch", "Discovery & audit", "Design handoff", "Implementation", "Content migration", "QA & launch"

打造一个跨平台桌面应用，把现有 CLI Agent、编码助手和自动化工作流统一编排成一个可管理、可追踪、可治理的 AI 团队。

它结合：

- **Multica** 的 Agent 生命周期管理：任务分配、进度追踪、技能复用、运行时管理；
- **Paperclip** 的目标治理能力：公司/项目目标、组织架构、预算、审批、审计日志；
- **golutra** 的桌面端多 Agent 编排体验：兼容现有 CLI、并行执行、可视化监控、后台终端、工作流模板。

成功状态是：用户不用迁移项目、不用重学命令，就能在一个桌面应用里连接 Claude Code、Codex、Gemini CLI、OpenCode、Cursor、任意 CLI Agent；创建目标、拆解任务、分配给不同 Agent 并行执行；实时查看日志、状态、成本、阻塞点和交付结果；必要时人工审批、暂停、接管或回滚。最终让“一人 + 多个 AI 工具”的混乱操作，升级成“一人指挥一个 AI 团队”的稳定工作流。

\## Success looks like

- 用户可在 Windows / macOS / Linux 桌面端运行。
- 可接入多个本地或远程 Agent Runtime。
- 支持任务看板、Agent 角色、团队/组织结构、工作流模板。
- 支持并行执行、后台终端、实时日志、结果回传。
- 支持预算/成本控制、审批门禁、完整审计记录。
- 支持长期任务、定时任务、上下文记忆和可复用技能。
- MVP 能完成一个真实软件开发闭环：需求 → 分解 → 多 Agent 执行 → 测试 → 汇总 → 人工确认交付。

参考源头：  
[Multica](https://github.com/multica-ai/multica) · [Paperclip](https://github.com/paperclipai/paperclip) · [golutra](https://github.com/golutra/golutra)

## Agents

> Agents are pre-created by Company Wizard. IDs listed below.

### Ceo

- **role**: ceo
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/ceo/AGENTS.md

### Engineer

- **role**: engineer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/engineer/AGENTS.md

### Product Owner

- **role**: product-owner
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/product-owner/AGENTS.md

### Ux Researcher

- **role**: ux-researcher
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/ux-researcher/AGENTS.md

### Ui Designer

- **role**: ui-designer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/ui-designer/AGENTS.md

### Technical Writer

- **role**: technical-writer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/technical-writer/AGENTS.md

### Security Engineer

- **role**: security-engineer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/security-engineer/AGENTS.md

### Qa

- **role**: qa
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/qa/AGENTS.md

### Devops

- **role**: devops
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/devops/AGENTS.md

### Customer Success

- **role**: customer-success
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/customer-success/AGENTS.md

### Cto

- **role**: cto
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/cto/AGENTS.md

### Code Reviewer

- **role**: code-reviewer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/code-reviewer/AGENTS.md

### Cmo

- **role**: cmo
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/cmo/AGENTS.md

### Cfo

- **role**: cfo
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/cfo/AGENTS.md

### Audio Designer

- **role**: audio-designer
- **instructionsFilePath**: /Users/cc_1/.paperclip/instances/default/companies/8/agents/audio-designer/AGENTS.md

## Issues

### Define company vision, success metrics, and strategic milestones

- **assigneeAgentId**: 2c748080-39c4-4beb-8dfe-cc90d0433302
- **priority**: medium
- **projectId**: → "花影风幻"

Refine the company goal into a clear vision statement, define measurable success metrics, and establish strategic milestones. Document in docs/VISION.md. This becomes the north star for all downstream planning.

### Conduct initial market analysis

- **assigneeAgentId**: 90574170-c11f-4ca2-b463-7c1133b3322a
- **priority**: medium
- **projectId**: → "花影风幻"

Research the target market, identify competitors, analyze positioning opportunities, and document findings in docs/MARKET-ANALYSIS.md. This informs the product roadmap and strategic priorities.

### Evaluate team composition and propose new hires

- **assigneeAgentId**: 34022585-4e32-4156-b20b-ad5d0014210f
- **priority**: medium
- **projectId**: → "花影风幻"

Review the current team against the company goal and project requirements. Identify missing expertise or capacity gaps. For each proposed hire, create a board approval request with the role, justification, and suggested adapter configuration.

### Evaluate and document technology choices

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Assess technology options for the project based on goals, constraints, and team capabilities. Document decisions, trade-offs, and rationale in docs/TECH-STACK.md.

### Design initial system architecture

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Based on the tech stack decisions, design the system architecture: component structure, data flow, API boundaries, and deployment model. Document in docs/ARCHITECTURE.md.

### Define design system and visual language

- **assigneeAgentId**: 65f46b83-c607-40b0-a9e3-7e801962fced
- **priority**: medium
- **projectId**: → "花影风幻"

Establish the visual foundation: color palette, typography, spacing scale, component patterns, and brand guidelines. Document in docs/DESIGN-SYSTEM.md.

### Initialize GitHub repository

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Create the GitHub repository, initialize with README, push initial commit to main, and set up branch protection if using PR workflow.

### Set up branch protection and PR requirements

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Configure the GitHub repository with branch protection on main: require PR reviews, disable direct pushes. Verify the PR workflow works with a test branch.

### Create roadmap and generate initial backlog

- **assigneeAgentId**: 34022585-4e32-4156-b20b-ad5d0014210f
- **priority**: medium
- **projectId**: → "花影风幻"

Review the company goal, create a ROADMAP.md with milestones, then generate the first batch of actionable issues from it.

### Define brand identity and visual guidelines

- **assigneeAgentId**: 65f46b83-c607-40b0-a9e3-7e801962fced
- **priority**: medium
- **projectId**: → "花影风幻"

Create the brand book: logo usage, color palette, typography, iconography, and tone-of-voice guidelines. Document everything in docs/BRAND-IDENTITY.md.

### Audit codebase and document architecture

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Read the existing codebase, map the architecture, identify tech debt hotspots and test coverage gaps. Document findings in docs/CODEBASE-AUDIT.md. Create follow-up issues for cleanup opportunities.

### Create initial project documentation

- **assigneeAgentId**: 0845b90a-0012-460d-9bed-cc4dd31d0b7f
- **priority**: medium
- **projectId**: → "花影风幻"

Write the foundational project documentation: README with setup instructions, architecture overview, API reference (if applicable), and contribution guide. Document in the project root and docs/ directory.

### Create project repository and initial structure

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Initialize the repository with README, .gitignore, package.json (or equivalent), and a basic project structure. Push to main.

### Write MVP scope document

- **assigneeAgentId**: 2c748080-39c4-4beb-8dfe-cc90d0433302
- **priority**: high
- **projectId**: → "花影风幻"

Draft a scope document that defines what the MVP includes and excludes. List the core user journey, key features (max 3), and explicit non-goals. Get team sign-off.

### Set up CI pipeline

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Add a CI workflow (GitHub Actions or equivalent) that runs lint and tests on every push. Keep it simple — single job, no matrix builds.

### Implement core feature

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Build the primary feature defined in the scope document. Focus on functionality over polish. Write tests for critical paths.

### Deploy to production

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Set up the production environment and deploy the application. Configure DNS, TLS, and basic monitoring/alerting. Verify the deployment with a smoke test.

### Write basic user documentation

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Create a getting-started guide that covers the core user journey. Keep it short — one page maximum. Include screenshots or examples where helpful.

### Collect and triage initial feedback

- **assigneeAgentId**: 2c748080-39c4-4beb-8dfe-cc90d0433302
- **priority**: medium
- **projectId**: → "花影风幻"

Gather feedback from early users. Categorize into: critical bugs, UX issues, and feature requests. Prioritize critical bugs for immediate fix.

### Fix critical bugs from feedback

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Address critical bugs identified during the feedback round. Each fix should include a regression test.

### Triage all open GitHub issues

- **assigneeAgentId**: 34022585-4e32-4156-b20b-ad5d0014210f
- **priority**: medium
- **projectId**: → "花影风幻"

Review all currently open issues on the GitHub repository. Classify each by type and priority, respond to reporters, close duplicates and invalid issues, and convert actionable items into Paperclip tasks.

### Design and execute initial usability evaluation

- **assigneeAgentId**: bef84f56-bbcb-4a4e-b201-f793723187bd
- **priority**: medium
- **projectId**: → "花影风幻"

Define test scenarios based on the company goal, identify target user personas, create a test plan, execute evaluations, and document findings in docs/USER-TESTING.md.

### Technical site audit

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Crawl the current website and document the technical baseline:
- Complete page inventory (every URL, status codes)
- Navigation structure and sitemap
- Tech stack and hosting (framework, CMS, CDN)
- SEO baseline (meta tags, structured data, robots.txt, sitemap.xml)
- Analytics and tracking scripts

Use WebFetch or Chrome to access each page. Output: `docs/SITE-AUDIT.md`.

### Visual and UX audit of current website

- **assigneeAgentId**: 65f46b83-c607-40b0-a9e3-7e801962fced
- **priority**: medium
- **projectId**: → "花影风幻"

Audit the current website visually — design patterns, content quality, UX observations, accessibility. Follow the `site-audit` skill. Append to `docs/SITE-AUDIT.md` or create `docs/DESIGN-AUDIT.md`.

### Analyze design assets and create design spec

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Process all design files in the `designs/` directory. Follow the `design-ingestion` skill for the full process.

**How to read design files:**
- **PDFs:** Use the Read tool with the `pages` parameter (e.g., pages 1–5, then 6–10) to view each page visually. Do NOT use text extraction as primary method — design PDFs are visual artifacts.
- **PNG/SVG/JPG:** Use the Read tool directly to view each image.
- **Fallback for precise values:** Use `markitdown` or `docling` (install via pip) to supplement visual analysis with extracted metadata. Use `pdffonts` for embedded font names.

**Extract:**
1. Design tokens — colors (hex/oklch), typography, spacing scale, border radii, shadows
2. Component inventory — recurring UI components
3. Page layouts — grid system, responsive breakpoints
4. Asset catalog — images, icons, illustrations

Output: `docs/DESIGN-SPEC.md` with all extracted tokens, components, and layouts.

### Technical site audit

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Crawl the current website and document the technical baseline:
- Complete page inventory (every URL, status codes)
- Navigation structure and sitemap
- Content types per page (text, images, videos, downloads)
- Tech stack and hosting (framework, CMS, CDN, response headers)
- SEO baseline (meta tags, structured data, canonical URLs, robots.txt, sitemap.xml)
- Analytics and tracking scripts
- Performance baseline (page weight, render-blocking resources)

Use WebFetch or Chrome to access each page. Output: `docs/SITE-AUDIT.md`.

### Visual and UX audit of current website

- **assigneeAgentId**: 65f46b83-c607-40b0-a9e3-7e801962fced
- **priority**: high
- **projectId**: → "花影风幻"

Audit the current website from a design and user experience perspective. Use Chrome to browse the site visually. Follow the `site-audit` skill.

For each page type, document:
- **Layout patterns** — grid structure, content zones, visual hierarchy
- **Design tokens in use** — colors, typography, spacing, component patterns
- **Content quality** — is copy clear, current, and on-brand? Flag outdated or placeholder content
- **UX observations** — navigation intuitiveness, user flows, friction points, dead ends
- **Accessibility** — heading hierarchy, image alt text, color contrast (visual estimate)

For each page, recommend: **keep** (design is strong), **redesign** (layout needs rethinking), **rewrite** (content is outdated), **merge**, or **drop**.

Append findings to `docs/SITE-AUDIT.md` under a 'Visual Design & UX' section, or create `docs/DESIGN-AUDIT.md` if the technical audit is already complete.

### Content audit of current website

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Crawl every page of the current website and audit the existing content to inform the redesign:

For each page, document:
- **Content type** — hero copy, body text, testimonials, FAQs, CTAs, legal, blog posts
- **Key messages** — what is the page trying to communicate? What value propositions are present?
- **Content quality** — is the copy clear, current, and on-brand? Flag outdated, placeholder, or thin content
- **Media assets** — images, videos, downloads — note which are reusable vs need replacement
- **SEO content** — headings, meta descriptions, alt text — what's working, what's missing
- **Gaps** — messaging that should exist but doesn't (e.g., missing social proof, no pricing clarity)

For each page, recommend a migration strategy:
- **Keep** — content is strong, migrate as-is into the new design
- **Rewrite** — message is right but copy needs updating for the new design/voice
- **Merge** — overlapping content across pages, consolidate
- **Drop** — no longer relevant, redirect or remove

Output: `docs/CONTENT-AUDIT.md` — this is a key input for the design handoff and content migration milestones.

### Create content inventory spreadsheet

- **assigneeAgentId**: 2c748080-39c4-4beb-8dfe-cc90d0433302
- **priority**: high
- **projectId**: → "花影风幻"

Based on the site audit and content review, create a structured content inventory:
- Page URL, title, word count, images, last updated
- Content status from review (keep / rewrite / merge / drop)
- Content owner (if identifiable)
- Migration priority: critical (homepage, key landing pages) vs secondary

Output: `docs/CONTENT-INVENTORY.md`.

### Provide design assets

- **assigneeUserId**: → board user
- **priority**: critical
- **projectId**: → "花影风幻"

Upload the design files from the external agency. Accepted formats:
- **PDF** — design comps, style guides (will be visually analyzed page by page)
- **PNG/SVG** — logos, icons, illustrations, page mockups
- **ZIP** — archive containing any of the above
- **URL** — link to a shared folder, Figma file, or hosted assets

Place files in the `designs/` directory of the project, or paste a download URL in a comment on this issue.

This issue blocks all implementation work.

### Analyze design assets and create design spec

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: critical
- **projectId**: → "花影风幻"

Process all design files in the `designs/` directory. Follow the `design-ingestion` skill for the full process.

**How to read design files:**
- **PDFs:** Use the Read tool with the `pages` parameter (e.g., pages 1–5, then 6–10) to view each page visually. Do NOT use text extraction as primary method — design PDFs are visual artifacts.
- **PNG/SVG/JPG:** Use the Read tool directly to view each image.
- **Fallback for precise values:** Use `markitdown` or `docling` (install via pip) to supplement visual analysis with extracted metadata. Use `pdffonts` for embedded font names.

**Extract:**
1. Design tokens — colors (hex/oklch), typography, spacing scale, border radii, shadows
2. Component inventory — recurring UI components
3. Page layouts — grid system, responsive breakpoints
4. Asset catalog — images, icons, illustrations

Output: `docs/DESIGN-SPEC.md` with all extracted tokens, components, and layouts.

### Implement core page layouts

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Configure the project for the new design, then build the primary page templates:

**Project setup:**
- CSS/styling approach (Tailwind, CSS modules, etc.) configured with design tokens from `docs/DESIGN-SPEC.md`
- Component library structure
- Framework configuration matching design spec requirements

**Core pages:**
- Homepage
- Key landing pages
- Standard content page layout
- Navigation (header, footer, mobile menu)

Apply design tokens (colors, typography, spacing) from the spec. Ensure responsive behavior matches the design breakpoints.

### Implement remaining pages and components

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Build all remaining pages and UI components identified in the design spec. Ensure consistent use of design tokens and component patterns. Include interactive elements (forms, accordions, modals) as specified.

### Migrate content from old site

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Using the content inventory (`docs/CONTENT-INVENTORY.md`), migrate content to the new site:
- Transfer text content, updating formatting for the new design
- Download and optimize images from the old site
- Preserve SEO-critical content (headings, meta descriptions, alt text)
- Flag content marked for rewrite and create issues for each

Verify no content is lost by cross-referencing the inventory.

### Create URL redirect map

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Map every old URL to its new equivalent:
- 1:1 redirects for pages that moved
- Pattern-based redirects for structural changes
- 410 Gone for intentionally removed pages
- Verify no orphaned URLs (old pages with no redirect)

Output: redirect configuration file appropriate for the hosting platform. Test all redirects locally.

### Cross-browser testing and performance optimization

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Test across Chrome, Firefox, Safari, and mobile viewports. Optimize:
- Image formats (WebP/AVIF with fallbacks)
- Lazy loading for below-fold content
- Font loading strategy (preload, swap)
- Bundle size and code splitting
- Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, INP < 200ms

### Pre-launch checklist and go-live

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: critical
- **projectId**: → "花影风幻"

Final verification before launch:
- [ ] All redirects configured and tested
- [ ] DNS records updated (or ready to switch)
- [ ] TLS/SSL certificate active
- [ ] Analytics and tracking re-installed
- [ ] robots.txt and sitemap.xml updated
- [ ] Social meta tags (Open Graph, Twitter cards)
- [ ] 404 page designed and implemented
- [ ] Monitoring and alerting configured

Deploy to production and verify with smoke test.

### Conduct initial threat model

- **assigneeAgentId**: 9a5804cc-0c2f-4014-8289-206b499efb94
- **priority**: medium
- **projectId**: → "花影风幻"

Identify attack surfaces, trust boundaries, and data flows using STRIDE methodology. Document the threat model in docs/THREAT-MODEL.md with risk ratings and mitigation recommendations.

### Perform initial security review

- **assigneeAgentId**: 9a5804cc-0c2f-4014-8289-206b499efb94
- **priority**: medium
- **projectId**: → "花影风幻"

Audit the codebase for OWASP Top 10 vulnerabilities, dependency CVEs, secrets exposure, and configuration issues. Document findings in docs/SECURITY-REVIEW.md with severity ratings.

### Conduct initial accessibility audit

- **assigneeAgentId**: bef84f56-bbcb-4a4e-b201-f793723187bd
- **priority**: medium
- **projectId**: → "花影风幻"

Audit the project for WCAG 2.2 compliance: check semantic HTML, keyboard navigation, color contrast, ARIA usage, and screen reader compatibility. Document findings and remediation plan in docs/ACCESSIBILITY-AUDIT.md.

### Design API schema and scaffold project

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Define the data model for the API's primary resources. Create database migrations. Scaffold the API project with route structure, health check endpoint, and request validation.

### Define database schema and create migrations

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Design the data model for the API's primary resources. Create database migration files that can set up the schema from scratch. Include indexes for common query patterns.

### Scaffold API project and route structure

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Set up the API project with the chosen framework (Express, Fastify, Django, etc.). Create the route/controller structure with placeholder endpoints that return 501. Add health check endpoint at GET /health.

### Implement CRUD endpoints for primary resource

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Build full CRUD (Create, Read, Update, Delete) for the main resource. Include input validation, proper HTTP status codes (201 for create, 404 for not found, 422 for validation errors), and pagination for list endpoints.

### Add request validation middleware

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Add middleware that validates request bodies and query parameters against defined schemas. Return clear 422 errors with field-level messages. Use a validation library (Zod, Joi, Pydantic, etc.).

### Add authentication middleware

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Implement authentication using JWT or session tokens. Add middleware that verifies tokens on protected routes and rejects unauthenticated requests with 401. Include a login/token endpoint.

### Add role-based authorization

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Implement authorization so users can only access resources they own or are permitted to see. Add role checks where needed. Return 403 for unauthorized access attempts.

### Generate API documentation

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Set up auto-generated API docs using OpenAPI/Swagger, or a similar tool. Annotate endpoints with descriptions, parameter types, and example responses. Serve docs at /api-docs or equivalent.

### Write API integration tests

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Write integration tests that hit the API endpoints with real HTTP requests. Cover happy paths, validation errors, auth failures, and edge cases. Use a test database that is reset between runs.

### Set up CI/CD pipeline

- **assigneeAgentId**: c9212c49-d61a-4240-9909-7126e0b839a8
- **priority**: medium
- **projectId**: → "花影风幻"

Configure continuous integration (lint, test, build) and deployment pipeline. Document the setup in docs/CI-CD.md. Use GitHub Actions or equivalent.

### Add linter and configure lint rules

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Install and configure a linter (ESLint, Ruff, golangci-lint, etc. depending on the stack). Use sensible defaults — focus on catching bugs, not style wars. Add a `lint` script to the project.

### Add lint step to CI workflow

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Add a linting step to the CI pipeline. It should run on every push and PR. Fail the build on lint errors.

### Add test runner and initial tests

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Set up a test runner (Jest, Vitest, pytest, go test, etc.). Write at least one meaningful test to verify the setup works. Add a `test` script to the project.

### Add test step to CI workflow

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: high
- **projectId**: → "花影风幻"

Add a testing step to the CI pipeline that runs the full test suite. Report results clearly — developers should know exactly what failed and why.

### Configure build step

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Add a build step that compiles/bundles the application into deployable artifacts. Ensure it runs in CI and outputs are consistent across environments.

### Set up deployment automation

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

Configure automated deployment to at least one environment (staging or production). Use the CI pipeline to trigger deploys on successful builds from the main branch. Include a rollback strategy.

### Add deployment smoke tests

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **priority**: medium
- **projectId**: → "花影风幻"

After each deployment, run a basic smoke test to verify the application is healthy. Check key endpoints, verify the correct version is deployed, and alert on failure.

### Build initial competitive landscape

- **assigneeAgentId**: bbdda772-841b-4923-b2e9-5deec8d6f5ab
- **priority**: medium
- **projectId**: → "花影风幻"

Research key competitors: their positioning, strengths, weaknesses, pricing, and recent moves. Document a living competitive landscape in docs/COMPETITIVE-LANDSCAPE.md with actionable differentiation insights.

### Audit dependencies and create upgrade plan

- **assigneeAgentId**: c9212c49-d61a-4240-9909-7126e0b839a8
- **priority**: medium
- **projectId**: → "花影风幻"

Audit all project dependencies for outdated versions, known vulnerabilities, and deprecated packages. Document findings and create a prioritized upgrade plan.

### Set up monitoring and observability

- **assigneeAgentId**: c9212c49-d61a-4240-9909-7126e0b839a8
- **priority**: medium
- **projectId**: → "花影风幻"

Configure health checks, error tracking, logging, and alerting. Document the observability strategy in docs/MONITORING.md.

### Document or establish release process

- **assigneeAgentId**: c9212c49-d61a-4240-9909-7126e0b839a8
- **priority**: medium
- **projectId**: → "花影风幻"

Review the current release workflow. If one exists, document it in docs/RELEASE-PROCESS.md. If not, establish a semver + changelog workflow with tagging conventions.

## Routines

### Backlog grooming

- **assigneeAgentId**: 34022585-4e32-4156-b20b-ad5d0014210f
- **schedule**: 0 10 * * 1,3,5
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Ensure backlog has at least 3 actionable unassigned issues. If running low, generate new issues from the roadmap.

### Auto-assign unassigned issues

- **assigneeAgentId**: 34022585-4e32-4156-b20b-ad5d0014210f
- **schedule**: 0 9,13 * * 1-5
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Find unassigned todo issues and assign to the best available agent based on role and workload.

### Stall detection

- **assigneeAgentId**: 2c748080-39c4-4beb-8dfe-cc90d0433302
- **schedule**: 0 9,14 * * 1-5
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Check all in_progress issues for signs of stalling. Nudge assigned agents, escalate if blocked for >24h.

### Broken link and redirect check

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **schedule**: 0 6 * * *
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Crawl the site and verify all internal links resolve, external links are reachable, and redirects from the old URL map return correct status codes.

### Performance and Core Web Vitals check

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **schedule**: 0 7 * * 1
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Run Lighthouse or equivalent against key pages. Track LCP, CLS, and INP. Flag regressions against baseline.

### API health check

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **schedule**: */15 * * * *
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Verify the API health endpoint responds correctly and monitor uptime.

### Dependency and security audit

- **assigneeAgentId**: bfc597fa-a051-4c16-99f9-a81ae28b71d9
- **schedule**: 0 8 * * 1
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Run dependency audit to check for known vulnerabilities in API dependencies. Flag any critical or high severity issues.

### CI pipeline health check

- **assigneeAgentId**: c9212c49-d61a-4240-9909-7126e0b839a8
- **schedule**: 0 9 * * 1-5
- **priority**: medium
- **concurrencyPolicy**: skip_if_active
- **projectId**: → "花影风幻"

Review recent CI runs for failures, flaky tests, and slow builds. Flag regressions and report pipeline health status.

## Provisioning Steps

The Company Wizard "Provision" step creates all of the above automatically.

Manual setup order (respects Paperclip object dependencies):

1. **Create company** "花影风幻"
2. **Create goal** "AgentOps Desktop：本地优先的多智能体工作中枢" (level: company)
3. **Create goal** "Build a REST API" (level: company, parentId → "AgentOps Desktop：本地优先的多智能体工作中枢")
4. **Create goal** "Schema design" (level: team, parentId → "Build a REST API")
5. **Create goal** "Core endpoints" (level: team, parentId → "Build a REST API")
6. **Create goal** "Authentication and authorization" (level: team, parentId → "Build a REST API")
7. **Create goal** "API documentation" (level: team, parentId → "Build a REST API")
8. **Create goal** "Set up CI/CD pipeline" (level: company, parentId → "AgentOps Desktop：本地优先的多智能体工作中枢")
9. **Create goal** "Automated linting" (level: team, parentId → "Set up CI/CD pipeline")
10. **Create goal** "Automated testing" (level: team, parentId → "Set up CI/CD pipeline")
11. **Create goal** "Automated build" (level: team, parentId → "Set up CI/CD pipeline")
12. **Create goal** "Automated deployment" (level: team, parentId → "Set up CI/CD pipeline")
13. **Create goal** "Launch MVP" (level: company, parentId → "AgentOps Desktop：本地优先的多智能体工作中枢")
14. **Create goal** "Define scope" (level: team, parentId → "Launch MVP")
15. **Create goal** "Build core feature" (level: team, parentId → "Launch MVP")
16. **Create goal** "Deploy" (level: team, parentId → "Launch MVP")
17. **Create goal** "Iterate" (level: team, parentId → "Launch MVP")
18. **Create goal** "Website Relaunch" (level: company, parentId → "AgentOps Desktop：本地优先的多智能体工作中枢")
19. **Create goal** "Discovery & audit" (level: team, parentId → "Website Relaunch")
20. **Create goal** "Design handoff" (level: team, parentId → "Website Relaunch")
21. **Create goal** "Implementation" (level: team, parentId → "Website Relaunch")
22. **Create goal** "Content migration" (level: team, parentId → "Website Relaunch")
23. **Create goal** "QA & launch" (level: team, parentId → "Website Relaunch")
24. **Create project** "花影风幻" (workspace: `/Users/cc_1/.paperclip/instances/default/companies/8/projects`, goalIds → ["AgentOps Desktop：本地优先的多智能体工作中枢", "Build a REST API", "Schema design", "Core endpoints", "Authentication and authorization", "API documentation", "Set up CI/CD pipeline", "Automated linting", "Automated testing", "Automated build", "Automated deployment", "Launch MVP", "Define scope", "Build core feature", "Deploy", "Iterate", "Website Relaunch", "Discovery & audit", "Design handoff", "Implementation", "Content migration", "QA & launch"])
25. **Create agents** — each with instructionsFilePath as listed above
26. **Create issues** — link each to its project
27. **Create routines** with cron triggers as listed above
28. **Start CEO heartbeat** (one-time initial wakeup)
