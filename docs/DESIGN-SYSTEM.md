# Design System

## Color Palette

All colors defined as CSS custom properties in `src/renderer/styles.css` (`:root`).

| Token | Value | Usage | Contrast on `--color-bg` |
|-------|-------|-------|--------------------------|
| `--color-primary` | `#3b82f6` | Primary actions, links | 4.6:1 (AA) |
| `--color-primary-hover` | `#2563eb` | Primary hover state | 3.7:1 (AA Large) |
| `--color-bg` | `#0f172a` | App background | — |
| `--color-surface` | `#1e293b` | Card/panel surfaces | 1.4:1 |
| `--color-surface-hover` | `#334155` | Surface hover state | 2.3:1 |
| `--color-border` | `#334155` | Borders, dividers | 2.3:1 |
| `--color-text` | `#f1f5f9` | Primary text | 14.7:1 (AAA) |
| `--color-text-muted` | `#94a3b8` | Secondary text, labels | 4.6:1 (AA) |
| `--color-text-tertiary` | `#768390` | Placeholder, metadata, timestamps | 4.6:1 (AA) |
| `--color-accent` | `#22d3ee` | Accent highlights | 8.4:1 (AAA) |

### Contrast Compliance

All text tokens meet WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text) against `--color-bg: #0f172a`.

## Typography

| Token | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| `--font-sans` | System stack | — | — | All UI text |
| `--font-mono` | SF Mono, Fira Code | — | — | Code, paths, config |

## Spacing Scale

Base unit: `4px` (implicit from Tailwind-like values in CSS).

## Component Patterns

### Buttons

- **Primary**: `<button type="submit">` — solid fill, text label
- **Sidebar action**: `.sidebar-action-btn` — outline style, text label (e.g., "+ Add Agent")
- **Danger**: `.btn-danger` — red variant for destructive actions
- **All buttons have visible text labels** — no icon-only buttons in current UI

### Inputs

- All `<input>`, `<select>`, `<textarea>` have associated `<label>` elements
- Visually hidden labels used where visual label is redundant (e.g., search, task move selects)
- Placeholder text uses `--color-text-tertiary` (4.5:1 contrast)

### Cards

- Agent cards: `.agent-status-card`, `.agent-card` — `role="listitem"`, `aria-label` with name/type/status
- Task cards: `.task-card` — `role="listitem"`, `aria-label` with title/status, move controls for WCAG 2.5.7

### Dialogs

- Native `<dialog>` element with `.showModal()` — provides implicit `role="dialog"`, `aria-modal="true"`, focus trapping, Escape-to-close
- All dialogs use `aria-labelledby` pointing to their `<h2>` title
- Focus returns to trigger element on close

## Accessibility: ARIA Live Regions

| Location | Element | `aria-live` | Purpose |
|----------|---------|-------------|---------|
| Login error | `<p id="login-error">` | `polite` | Auth error messages |
| Dashboard refresh | `<span id="dashboard-last-refresh">` | `polite` | Last refresh timestamp |
| Agent list error | `<div id="agent-list-error">` | `polite` | Agent CRUD errors |
| Task column counts | `<span class="task-column-count">` ×4 | `polite` | Column count updates |
| Global announcer | `<div class="sr-announcer">` (dynamic) | `polite` | Agent/task CRUD success/failure |

### Announcer Pattern

A global `role="status"` announcer is appended to `<body>` at runtime. The `announce(message)` function clears then sets text via `requestAnimationFrame` to force re-announcement. Used for:
- Agent create/update/delete success/failure
- Task move success/failure

## Accessibility: Keyboard Navigation

- Skip link: `<a href="#main-content">` for keyboard users
- Tab order follows DOM order: sidebar → main content → modals
- Task movement: "Move to" `<select>` + button provides non-dragging alternative (WCAG 2.5.7)
- `<select>` supports Enter key to trigger move action
- Focus trap in modals with safety net for Tab/Shift+Tab cycling

## Brand Guidelines

AgentOps Desktop — dark theme, developer-focused UI.

## Responsive Breakpoints

Single breakpoint approach — app uses fixed sidebar layout.
